const express    = require("express");
const http       = require("http");
const { Server } = require("socket.io");
const bodyParser = require("body-parser");
const { createClient } = require("@libsql/client");

const app    = express();
const server = http.createServer(app);
const io     = new Server(server);
const port   = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(express.static("public"));

// --- Database setup (Turso / libSQL) ---
const db = createClient({
  url:       process.env.TURSO_URL   || "file:./quiz.db",  // local fallback for dev
  authToken: process.env.TURSO_TOKEN || undefined
});

async function initDB() {
  await db.execute(`PRAGMA foreign_keys = ON`);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS eras (
      id   INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL
    )
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS questions (
      id       INTEGER PRIMARY KEY AUTOINCREMENT,
      era_id   INTEGER NOT NULL,
      text     TEXT NOT NULL,
      option_a TEXT NOT NULL,
      option_b TEXT NOT NULL,
      option_c TEXT NOT NULL,
      option_d TEXT NOT NULL,
      correct  TEXT NOT NULL DEFAULT 'A',
      FOREIGN KEY (era_id) REFERENCES eras(id) ON DELETE CASCADE
    )
  `);
  console.log("Database ready.");
}

initDB().catch(console.error);

// --- ERAS ---
app.get("/eras", async (req, res) => {
  try {
    const result = await db.execute("SELECT * FROM eras ORDER BY id ASC");
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/eras", async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: "Name required" });
  try {
    const result = await db.execute({ sql: "INSERT INTO eras (name) VALUES (?)", args: [name] });
    res.json({ id: Number(result.lastInsertRowid), name });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete("/eras/:id", async (req, res) => {
  const { id } = req.params;
  try {
    await db.execute(`PRAGMA foreign_keys = ON`);
    const result = await db.execute({ sql: "DELETE FROM eras WHERE id = ?", args: [id] });
    res.json({ deleted: result.rowsAffected });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- QUESTIONS ---
app.get("/questions/:eraId", async (req, res) => {
  const eraId = parseInt(req.params.eraId);
  let sql = "SELECT q.*, e.name as era_name FROM questions q JOIN eras e ON q.era_id = e.id";
  const args = [];
  if (eraId > 0) { sql += " WHERE q.era_id = ?"; args.push(eraId); }
  sql += " ORDER BY q.id ASC";
  try {
    const result = await db.execute({ sql, args });
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/questions", async (req, res) => {
  const { era_id, text, option_a, option_b, option_c, option_d, correct } = req.body;
  if (!era_id || !text || !option_a || !option_b || !option_c || !option_d || !correct)
    return res.status(400).json({ error: "All fields required" });
  try {
    const result = await db.execute({
      sql:  `INSERT INTO questions (era_id, text, option_a, option_b, option_c, option_d, correct) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [era_id, text, option_a, option_b, option_c, option_d, correct]
    });
    res.json({ id: Number(result.lastInsertRowid), era_id, text, option_a, option_b, option_c, option_d, correct });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put("/questions/:id", async (req, res) => {
  const { id } = req.params;
  const { era_id, text, option_a, option_b, option_c, option_d, correct } = req.body;
  if (!text || !option_a || !option_b || !option_c || !option_d || !correct)
    return res.status(400).json({ error: "All fields required" });
  try {
    const result = await db.execute({
      sql:  `UPDATE questions SET era_id=?, text=?, option_a=?, option_b=?, option_c=?, option_d=?, correct=? WHERE id=?`,
      args: [era_id, text, option_a, option_b, option_c, option_d, correct, id]
    });
    res.json({ updated: result.rowsAffected });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete("/questions/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.execute({ sql: "DELETE FROM questions WHERE id = ?", args: [id] });
    res.json({ deleted: result.rowsAffected });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// -----------------------------------------------
// GAME STATE
// -----------------------------------------------
const rooms = {};

function getRoom(pin) {
  if (!rooms[pin]) {
    rooms[pin] = {
      hostSocketId:     null,
      players:          [],
      questions:        [],
      currentIndex:     -1,
      era:              null,
      answersThisRound: {},
      timerHandle:      null,
      started:          false
    };
  }
  return rooms[pin];
}

function broadcastPlayers(pin) {
  const room = rooms[pin];
  if (!room) return;
  io.to(pin).emit("update-players", room.players.map(p => ({ name: p.name, avatar: p.avatar, score: p.score })));
}

function sendQuestion(pin) {
  const room = rooms[pin];
  if (!room) return;
  if (room.currentIndex >= room.questions.length) { endGame(pin); return; }

  const q = room.questions[room.currentIndex];
  room.answersThisRound = {};

  io.to(pin).emit("next-question", {
    questionNumber: room.currentIndex + 1,
    totalQuestions: room.questions.length,
    question_text:  q.text,
    a: q.option_a,
    b: q.option_b,
    c: q.option_c,
    d: q.option_d,
    time: 30
  });

  if (room.timerHandle) clearTimeout(room.timerHandle);
  room.timerHandle = setTimeout(() => advanceQuestion(pin), 31000);
}

function advanceQuestion(pin) {
  const room = rooms[pin];
  if (!room) return;
  if (room.timerHandle) { clearTimeout(room.timerHandle); room.timerHandle = null; }
  room.currentIndex++;
  if (room.currentIndex >= room.questions.length) {
    endGame(pin);
  } else {
    sendQuestion(pin);
  }
}

function checkAllAnswered(pin) {
  const room = rooms[pin];
  if (!room || room.players.length === 0) return;
  if (Object.keys(room.answersThisRound).length >= room.players.length) {
    if (room.timerHandle) clearTimeout(room.timerHandle);
    room.timerHandle = setTimeout(() => advanceQuestion(pin), 1500);
  }
}

function endGame(pin) {
  const room = rooms[pin];
  if (!room) return;
  if (room.timerHandle) { clearTimeout(room.timerHandle); room.timerHandle = null; }
  const sorted  = [...room.players].sort((a, b) => b.score - a.score);
  const results = sorted.map((p, i) => ({ rank: i + 1, name: p.name, avatar: p.avatar, score: p.score }));
  io.to(pin).emit("game-finished", results);
}

// -----------------------------------------------
// SOCKET.IO
// -----------------------------------------------
io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id);

  socket.on("host-join", (pin) => {
    const room = getRoom(pin);
    room.hostSocketId = socket.id;
    socket.join(pin);
    broadcastPlayers(pin);
    console.log(`Host joined room ${pin}`);
  });

  socket.on("player-join", ({ pin, name, avatar }) => {
    const room     = getRoom(pin);
    const existing = room.players.find(p => p.name === name);
    if (existing) {
      existing.socketId = socket.id;
      existing.avatar   = avatar;
    } else {
      room.players.push({ socketId: socket.id, name, avatar, score: 0 });
    }
    socket.join(pin);
    socket.data.pin  = pin;
    socket.data.name = name;
    broadcastPlayers(pin);
    console.log(`Player ${name} joined room ${pin}`);

    // If game already started, send current question immediately
    if (room.started && room.currentIndex >= 0 && room.currentIndex < room.questions.length) {
      const q = room.questions[room.currentIndex];
      socket.emit("next-question", {
        questionNumber: room.currentIndex + 1,
        totalQuestions: room.questions.length,
        question_text:  q.text,
        a: q.option_a,
        b: q.option_b,
        c: q.option_c,
        d: q.option_d,
        time: 30
      });
    }
  });

  socket.on("select-era", ({ pin, era }) => {
    const room = getRoom(pin);
    room.era = era;
    db.execute({
      sql:  `SELECT q.* FROM questions q JOIN eras e ON q.era_id = e.id WHERE e.name = ? ORDER BY RANDOM()`,
      args: [era]
    }).then(result => {
      room.questions    = result.rows;
      room.currentIndex = 0;
      room.started      = true;
      console.log(`Loaded ${result.rows.length} questions for era "${era}" in room ${pin}`);
      sendQuestion(pin);
    }).catch(console.error);
  });

  socket.on("submit-answer", ({ pin, player, answer }) => {
    const room = rooms[pin];
    if (!room || !room.started) return;
    const q = room.questions[room.currentIndex];
    if (!q) return;
    room.answersThisRound[socket.id] = answer;
    if (answer.toLowerCase() === q.correct.toLowerCase()) {
      const p = room.players.find(pl => pl.name === player);
      if (p) p.score += 1;
    }
    checkAllAnswered(pin);
  });

  socket.on("next-question", (pin) => {
    advanceQuestion(pin);
  });

  socket.on("request-current-question", (pin) => {
    const room = rooms[pin];
    if (!room || !room.started || room.currentIndex < 0 || room.currentIndex >= room.questions.length) return;
    const q = room.questions[room.currentIndex];
    socket.emit("next-question", {
      questionNumber: room.currentIndex + 1,
      totalQuestions: room.questions.length,
      question_text:  q.text,
      a: q.option_a,
      b: q.option_b,
      c: q.option_c,
      d: q.option_d,
      time: 30
    });
  });

  socket.on("reset-game", (pin) => {
    const room = rooms[pin];
    if (!room) return;
    if (room.timerHandle) clearTimeout(room.timerHandle);
    room.players          = [];
    room.questions        = [];
    room.currentIndex     = -1;
    room.answersThisRound = {};
    room.started          = false;
    room.timerHandle      = null;
    broadcastPlayers(pin);
  });

  socket.on("disconnect", () => {
    const pin = socket.data.pin;
    if (pin && rooms[pin]) {
      console.log(`Socket ${socket.id} disconnected from room ${pin}`);
    }
  });
});

server.listen(port, () => console.log(`Server running on port ${port}`));
