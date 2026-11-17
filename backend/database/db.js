/**
 * BuyNana local SQLite connection. Node >=22.12, launched with --experimental-sqlite.
 * Uses Node's built-in SQLite driver: no native npm add-on or Visual Studio compiler.
 */
const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');
const dbPath = process.env.BUYNANA_DB_PATH || path.join(__dirname, 'buynana.db');
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
const db = new DatabaseSync(dbPath);
db.exec('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
// Compatibility with the transactions API used throughout the project.
db.pragma = (statement) => db.prepare(`PRAGMA ${statement}`).all();
db.transaction = (callback) => (...args) => {
    db.exec('BEGIN IMMEDIATE');
    try {
        const result = callback(...args);
        db.exec('COMMIT');
        return result;
    } catch (error) {
        db.exec('ROLLBACK');
        throw error;
    }
};

db.exec(`
CREATE TABLE IF NOT EXISTS transactions (
  transaction_id INTEGER PRIMARY KEY AUTOINCREMENT,
  description TEXT NOT NULL,
  amount REAL NOT NULL CHECK(amount > 0),
  type TEXT NOT NULL CHECK(type IN ('income','expense')),
  category TEXT NOT NULL,
  transaction_date TEXT NOT NULL DEFAULT (date('now'))
);
CREATE TABLE IF NOT EXISTS budgets (
  budget_id INTEGER PRIMARY KEY AUTOINCREMENT,
  category TEXT NOT NULL,
  budget_amount REAL NOT NULL CHECK (budget_amount > 0),
  budget_month TEXT NOT NULL,
  UNIQUE(category, budget_month)
);
CREATE TABLE IF NOT EXISTS savings_goals (
  goal_id INTEGER PRIMARY KEY AUTOINCREMENT,
  goal_name TEXT NOT NULL,
  target_amount REAL NOT NULL CHECK(target_amount > 0),
  created_at TEXT NOT NULL DEFAULT (date('now')),
  is_archived INTEGER NOT NULL DEFAULT 0 CHECK(is_archived IN (0,1))
);
CREATE TABLE IF NOT EXISTS savings_contributions (
  contribution_id INTEGER PRIMARY KEY AUTOINCREMENT,
  goal_id INTEGER NOT NULL,
  amount REAL NOT NULL CHECK(amount > 0),
  contribution_date TEXT NOT NULL DEFAULT (date('now')),
  FOREIGN KEY(goal_id) REFERENCES savings_goals(goal_id)
);
`);
function addColumnIfMissing(table, column, definition) {
    const columns = db.prepare(`PRAGMA table_info(${table})`).all();
    if (!columns.some(item => item.name === column)) {
        db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    }
}
addColumnIfMissing('transactions', 'is_recurring', 'INTEGER NOT NULL DEFAULT 0 CHECK(is_recurring IN(0,1))');
addColumnIfMissing('transactions', 'recurring_frequency', "TEXT CHECK(recurring_frequency IS NULL OR recurring_frequency IN ('weekly','monthly','yearly'))");
addColumnIfMissing('savings_goals', 'monthly_allocation', 'REAL NOT NULL DEFAULT 0 CHECK(monthly_allocation >= 0)');
module.exports = db;
