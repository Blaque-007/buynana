const {DatabaseSync} = require("node:sqlite");

const {
    createSeasonalService
} = require("../services/seasonalService");

// Create an in-memory database.
// Nothing is written to BuyNana's actual SQLite database.
const testDb = new DatabaseSync(":memory:");

testDb.exec(`
    CREATE TABLE transactions (
        transaction_id INTEGER PRIMARY KEY AUTOINCREMENT,
        description TEXT,
        amount REAL,
        type TEXT,
        category TEXT,
        transaction_date TEXT,
        is_recurring INTEGER DEFAULT 0
    );
`);

const insertTransaction = testDb.prepare(`
    INSERT INTO transactions (
        description,
        amount,
        type,
        category,
        transaction_date,
        is_recurring
    )
    VALUES (?, ?, ?, ?, ?, ?)
`);

// Insert two complete years of sample transactions.
for (const year of [2024, 2025]) {
    for (let month = 1; month <= 12; month++) {

        const monthString = String(month).padStart(2, "0");

        const transactionDate =
            `${year}-${monthString}-15`;

        // December spending is higher.
        const groceryAmount = month === 12 ? 450 : 300;

        insertTransaction.run(
            "Groceries",
            groceryAmount,
            "expense",
            "Groceries",
            transactionDate,
            0
        );
    }
}

const seasonalService = createSeasonalService(testDb);

const december = seasonalService.calculateSeasonalFactor(
    "Groceries",
    12
);

const january = seasonalService.calculateSeasonalFactor(
    "Groceries",
    1
);

console.log("\nDECEMBER SEASONAL FACTOR");
console.log(december);

console.log("\nJANUARY SEASONAL FACTOR");
console.log(january);

// Verify results.
const decemberCorrect =
    december.sufficient_history &&
    Math.abs(december.seasonal_factor - 1.44) < 0.001;

const januaryCorrect =
    january.sufficient_history &&
    Math.abs(january.seasonal_factor - 0.96) < 0.001;

console.log("\nTEST RESULTS");

console.log(
    "December factor correct:",
    decemberCorrect
);

console.log(
    "January factor correct:",
    januaryCorrect
);

testDb.close();

if (!decemberCorrect || !januaryCorrect) {
    process.exitCode = 1;
}