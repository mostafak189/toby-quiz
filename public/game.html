const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const sqlite3 = require("sqlite3").verbose();
const bodyParser = require("body-parser");
const app = express();
const server = http.createServer(app);
const io = new Server(server);
const port = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(express.static("public"));

// --- Database setup ---
const db = new sqlite3.Database("./quiz.db", (err) => {
  if (err) return console.error(err.message);
  console.log("Connected to SQLite database.");
});

db.serialize(() => {
  db.run(`PRAGMA foreign_keys = ON`);
  db.run(`
    CREATE TABLE IF NOT EXISTS eras (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      era_id INTEGER NOT NULL,
      text TEXT NOT NULL,
      option_a TEXT NOT NULL,
      option_b TEXT NOT NULL,
      option_c TEXT NOT NULL,
      option_d TEXT NOT NULL,
      correct TEXT NOT NULL DEFAULT 'A',
      FOREIGN KEY (era_id) REFERENCES eras(id) ON DELETE CASCADE
    )
  `);
});

// --- ERAS ---
app.get("/eras", (req, res) => {
  db.all("SELECT * FROM eras ORDER BY id ASC", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post("/eras", (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: "Name required" });
  db.run("INSERT INTO eras (name) VALUES (?)", [name], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id: this.lastID, name });
  });
});

app.delete("/eras/:id", (req, res) => {
  const { id } = req.params;
  db.run("PRAGMA foreign_keys = ON", () => {
    db.run("DELETE FROM eras WHERE id = ?", [id], function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ deleted: this.changes });
    });
  });
});

// --- QUESTIONS ---
app.get("/questions/:eraId", (req, res) => {
  const eraId = parseInt(req.params.eraId);
  let sql = "SELECT q.*, e.name as era_name FROM questions q JOIN eras e ON q.era_id = e.id";
  const params = [];
  if (eraId > 0) { sql += " WHERE q.era_id = ?"; params.push(eraId); }
  sql += " ORDER BY q.id ASC";
  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post("/questions", (req, res) => {
  const { era_id, text, option_a, option_b, option_c, option_d, correct } = req.body;
  if (!era_id || !text || !option_a || !option_b || !option_c || !option_d || !correct)
    return res.status(400).json({ error: "All fields required" });
  db.run(
    `INSERT INTO questions (era_id, text, option_a, option_b, option_c, option_d, correct) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [era_id, text, option_a, option_b, option_c, option_d, correct],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID, era_id, text, option_a, option_b, option_c, option_d, correct });
    }
  );
});

app.put("/questions/:id", (req, res) => {
  const { id } = req.params;
  const { era_id, text, option_a, option_b, option_c, option_d, correct } = req.body;
  if (!text || !option_a || !option_b || !option_c || !option_d || !correct)
    return res.status(400).json({ error: "All fields required" });
  db.run(
    `UPDATE questions SET era_id=?, text=?, option_a=?, option_b=?, option_c=?, option_d=?, correct=? WHERE id=?`,
    [era_id, text, option_a, option_b, option_c, option_d, correct, id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ updated: this.changes });
    }
  );
});

app.delete("/questions/:id", (req, res) => {
  const { id } = req.params;
  db.run("DELETE FROM questions WHERE id = ?", [id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ deleted: this.changes });
  });
});

// -----------------------------------------------
// GAME STATE
// -----------------------------------------------
// rooms[pin] = {
//   hostSocketId,
//   players: [ { socketId, name, avatar, score } ],
//   questions: [],
//   currentIndex: -1,
//   era: null,
//   answersThisRound: {},   // socketId -> answer
//   timerHandle: null,
//   started: false
// }
const rooms = {};

function getRoom(pin) {
  if (!rooms[pin]) {
    rooms[pin] = {
      hostSocketId: null,
      players: [],
      questions: [],
      currentIndex: -1,
      era: null,
      answersThisRound: {},
      timerHandle: null,
      started: false
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
  if (room.currentIndex >= room.questions.length) {
    endGame(pin);
    return;
  }
  const q = room.questions[room.currentIndex];
  room.answersThisRound = {};

  io.to(pin).emit("next-question", {
    questionNumber: room.currentIndex + 1,
    totalQuestions: room.questions.length,
    question_text: q.text,
    a: q.option_a,
    b: q.option_b,
    c: q.option_c,
    d: q.option_d,
    time: 30
  });

  // Auto-advance after 30s
  if (room.timerHandle) clearTimeout(room.timerHandle);
  room.timerHandle = setTimeout(() => {
    advanceQuestion(pin);
  }, 31000);
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
  const answered = Object.keys(room.answersThisRound).length;
  if (answered >= room.players.length) {
    // Small delay so last player can see their submission
    if (room.timerHandle) clearTimeout(room.timerHandle);
    room.timerHandle = setTimeout(() => advanceQuestion(pin), 1500);
  }
}

function endGame(pin) {
  const room = rooms[pin];
  if (!room) return;
  if (room.timerHandle) { clearTimeout(room.timerHandle); room.timerHandle = null; }

  const sorted = [...room.players].sort((a, b) => b.score - a.score);
  const results = sorted.map((p, i) => ({ rank: i + 1, name: p.name, avatar: p.avatar, score: p.score }));
  io.to(pin).emit("game-finished", results);
}

// -----------------------------------------------
// SOCKET.IO
// -----------------------------------------------
io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id);

  // Host creates/joins a room
  socket.on("host-join", (pin) => {
    const room = getRoom(pin);
    room.hostSocketId = socket.id;
    socket.join(pin);
    broadcastPlayers(pin);
    console.log(`Host joined room ${pin}`);
  });

  // Player joins
  socket.on("player-join", ({ pin, name, avatar }) => {
    const room = getRoom(pin);
    // Prevent duplicate names — update socketId if reconnecting
    const existing = room.players.find(p => p.name === name);
    if (existing) {
      existing.socketId = socket.id;
      existing.avatar = avatar; // update avatar in case
    } else {
      room.players.push({ socketId: socket.id, name, avatar, score: 0 });
    }
    socket.join(pin);
    socket.data.pin = pin;
    socket.data.name = name;
    broadcastPlayers(pin);
    console.log(`Player ${name} joined room ${pin}`);

    // If game already started, immediately send the current question to this socket
    if (room.started && room.currentIndex >= 0 && room.currentIndex < room.questions.length) {
      const q = room.questions[room.currentIndex];
      socket.emit("next-question", {
        questionNumber: room.currentIndex + 1,
        totalQuestions: room.questions.length,
        question_text: q.text,
        a: q.option_a,
        b: q.option_b,
        c: q.option_c,
        d: q.option_d,
        time: 30
      });
    }
  });

  // Host selects era and starts game
  socket.on("select-era", ({ pin, era }) => {
    const room = getRoom(pin);
    room.era = era;
    console.log(`Era selected for ${pin}: ${era}`);

    db.all("SELECT q.* FROM questions q JOIN eras e ON q.era_id = e.id WHERE e.name = ? ORDER BY RANDOM()", [era], (err, rows) => {
      if (err) { console.error(err); return; }
      room.questions = rows;
      room.currentIndex = 0;
      room.started = true;
      console.log(`Loaded ${rows.length} questions for era ${era} in room ${pin}`);
      sendQuestion(pin);
    });
  });

  // Player submits answer
  socket.on("submit-answer", ({ pin, player, answer }) => {
    const room = rooms[pin];
    if (!room || !room.started) return;

    const q = room.questions[room.currentIndex];
    if (!q) return;

    // Record answer
    room.answersThisRound[socket.id] = answer;

    // Check correctness
    if (answer.toLowerCase() === q.correct.toLowerCase()) {
      const p = room.players.find(pl => pl.name === player);
      if (p) p.score += 1;
    }

    checkAllAnswered(pin);
  });

  // Manual next question (host button)
  socket.on("next-question", (pin) => {
    advanceQuestion(pin);
  });

  // Late joiner requests current question
  socket.on("request-current-question", (pin) => {
    const room = rooms[pin];
    if (!room || !room.started || room.currentIndex < 0 || room.currentIndex >= room.questions.length) return;
    const q = room.questions[room.currentIndex];
    socket.emit("next-question", {
      questionNumber: room.currentIndex + 1,
      totalQuestions: room.questions.length,
      question_text: q.text,
      a: q.option_a,
      b: q.option_b,
      c: q.option_c,
      d: q.option_d,
      time: 30
    });
  });

  // Reset game
  socket.on("reset-game", (pin) => {
    const room = rooms[pin];
    if (!room) return;
    if (room.timerHandle) clearTimeout(room.timerHandle);
    room.players = [];
    room.questions = [];
    room.currentIndex = -1;
    room.answersThisRound = {};
    room.started = false;
    room.timerHandle = null;
    broadcastPlayers(pin);
  });

  socket.on("disconnect", () => {
    const pin = socket.data.pin;
    if (pin && rooms[pin]) {
      // Don't remove player on disconnect (they may reconnect)
      console.log(`Socket ${socket.id} disconnected from room ${pin}`);
    }
  });
});

server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
