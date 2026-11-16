const Database = require("better-sqlite3");

// Update this path to match your actual database location.
const db = new Database("./database/buynana.db", {
    readonly: true,
    fileMustExist: true
});

const tables = db.prepare(`
    SELECT name
    FROM sqlite_master
    WHERE type = 'table'
      AND name NOT LIKE 'sqlite_%'
    ORDER BY name
`).all();

console.log("\nDATABASE TABLES:");
console.table(tables);

for (const table of tables) {
    if (table.name.toLowerCase().includes("budget")) {
        const columns = db.pragma(
            `table_info("${table.name.replace(/"/g, '""')}")`
        );

        console.log(`\nCOLUMNS IN ${table.name}:`);
        console.table(columns);
    }
}

db.close();