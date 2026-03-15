const sqlite3 = require("sqlite3").verbose();
const db = new sqlite3.Database("./quiz.db");

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

  console.log("Database initialized successfully.");
});

db.close();
