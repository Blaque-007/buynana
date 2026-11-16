const Database = require("better-sqlite3");
const path = require("path");

// Define where the SQLite database file will be stored
const dbPath = path.join(__dirname, "buynana.db");

// Open the database, or create it if it doesn't exist
const db = new Database(dbPath);

// Enable foreign key relationships
db.pragma("foreign_keys = ON");

// Create our first database table
db.exec(`
    CREATE TABLE IF NOT EXISTS transactions (
        transaction_id INTEGER PRIMARY KEY AUTOINCREMENT,
        description TEXT NOT NULL,
        amount REAL NOT NULL CHECK (amount > 0),
        type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
        category TEXT NOT NULL,
        transaction_date TEXT NOT NULL DEFAULT (date('now'))
    );
`);

console.log("BuyNana database connected successfully!");

// Check which columns already exist in transactions
const transactionColumns = db
    .prepare("PRAGMA table_info(transactions)")
    .all();

const existingColumnNames = transactionColumns.map(
    column => column.name
);

// Add recurring flag if it doesn't exist
if (!existingColumnNames.includes("is_recurring")) {

    db.exec(`
        ALTER TABLE transactions
        ADD COLUMN is_recurring INTEGER NOT NULL DEFAULT 0
        CHECK (is_recurring IN (0, 1))
    `);

    console.log("Added is_recurring column.");
}

// Add recurring frequency if it doesn't exist
if (!existingColumnNames.includes("recurring_frequency")) {

    db.exec(`
        ALTER TABLE transactions
        ADD COLUMN recurring_frequency TEXT
        CHECK (
            recurring_frequency IS NULL
            OR recurring_frequency IN ('weekly', 'monthly', 'yearly')
        )
    `);

    console.log("Added recurring_frequency column.");
}

// Create the monthly budgets table
db.exec(`
    CREATE TABLE IF NOT EXISTS budgets (
        budget_id INTEGER PRIMARY KEY AUTOINCREMENT,
        category TEXT NOT NULL,
        budget_amount REAL NOT NULL CHECK (budget_amount > 0),
        budget_month TEXT NOT NULL,
        UNIQUE(category, budget_month)
    );
`);

console.log("BuyNana budgets table ready!");

// ============================================================
// SAVINGS MANAGEMENT TABLES
// ============================================================

// Store savings goals
db.exec(`
    CREATE TABLE IF NOT EXISTS savings_goals (
        goal_id INTEGER PRIMARY KEY AUTOINCREMENT,

        goal_name TEXT NOT NULL,

        target_amount REAL NOT NULL
            CHECK (target_amount > 0),

        created_at TEXT NOT NULL
            DEFAULT (date('now')),

        is_archived INTEGER NOT NULL DEFAULT 0
            CHECK (is_archived IN (0, 1))
    );
`);

// Store contributions made toward savings goals
db.exec(`
    CREATE TABLE IF NOT EXISTS savings_contributions (
        contribution_id INTEGER PRIMARY KEY AUTOINCREMENT,

        goal_id INTEGER NOT NULL,

        amount REAL NOT NULL
            CHECK (amount > 0),

        contribution_date TEXT NOT NULL
            DEFAULT (date('now')),

        FOREIGN KEY (goal_id)
            REFERENCES savings_goals(goal_id)
    );
`);

console.log("BuyNana savings tables ready!");

module.exports = db;