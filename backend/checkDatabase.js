const db = require("./database/db");

console.log("\n=== TRANSACTION TABLE STRUCTURE ===");

const columns = db
    .prepare("PRAGMA table_info(transactions)")
    .all();

console.table(
    columns.map(column => ({
        Column: column.name,
        Type: column.type,
        Default: column.dflt_value
    }))
);

console.log("\n=== EXISTING TRANSACTIONS ===");

const transactions = db.prepare(`
    SELECT
        transaction_id,
        description,
        amount,
        is_recurring,
        recurring_frequency
    FROM transactions
    LIMIT 5
`).all();

console.table(transactions);

db.close();