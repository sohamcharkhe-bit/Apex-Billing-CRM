const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const config = require('../config/config');

// Ensure database directory exists
const dbDir = path.dirname(config.dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Open SQLite database connection (pure leaf module)
console.log(`[DB] Opening database at: ${config.dbPath}`);
const db = new DatabaseSync(config.dbPath);

// Enable foreign key constraints and WAL mode
db.exec('PRAGMA foreign_keys = ON;');
db.exec('PRAGMA journal_mode = WAL;');

// Attach pragma helper
db.pragma = function(pragmaStr) {
  return db.exec('PRAGMA ' + pragmaStr);
};

// Attach transaction helper
db.transaction = function(fn) {
  return function(...args) {
    db.exec('BEGIN IMMEDIATE');
    try {
      const result = fn(...args);
      db.exec('COMMIT');
      return result;
    } catch (err) {
      try {
        db.exec('ROLLBACK');
      } catch (rbErr) {
        // In case transaction wasn't active
      }
      throw err;
    }
  };
};

// Initialize schema
const schemaPath = path.join(__dirname, 'schema.sql');
if (fs.existsSync(schemaPath)) {
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');
  db.exec(schemaSql);
}

module.exports = db;
