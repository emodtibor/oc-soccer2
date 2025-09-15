const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'app.sqlite');

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) console.error('SQLite open error:', err.message);
});
module.exports = db;
