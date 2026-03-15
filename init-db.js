const sqlite3 = require("sqlite3").verbose();

const db = new sqlite3.Database("quiz.db");

db.serialize(()=>{

db.run(`
CREATE TABLE IF NOT EXISTS eras(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 name TEXT NOT NULL
)
`);

db.run(`
CREATE TABLE IF NOT EXISTS questions(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 era_id INTEGER,
 text TEXT,
 option_a TEXT,
 option_b TEXT,
 option_c TEXT,
 option_d TEXT,
 correct TEXT
)
`);

console.log("Database initialized");

});

db.close();