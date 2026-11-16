const express = require("express");
const cors = require("cors");
const db = require("./database/db");
const app = express();
const PORT = 3001;


// Allow requests from React
app.use(cors({
    origin: "http://localhost:5173"
}));

// Allow JSON requests
app.use(express.json());

// Test endpoint
app.get("/api/health", (req, res) => {
    res.json({
        status: "success",
        message: "BuyNana backend is running!"
    });
});

// Retrieve all transactions
app.get("/api/transactions", (req, res) => {
    try {
        const transactions = db.prepare(`
            SELECT *
            FROM transactions
            ORDER BY transaction_date DESC, transaction_id DESC
        `).all();

        res.json(transactions);

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Unable to retrieve transactions" });
    }
});

// Add a new transaction
app.post("/api/transactions", (req, res) => {
    try {
        const { description, amount, type, category } = req.body;

        if (
            typeof description !== "string" ||
            !description.trim() ||
            typeof amount !== "number" ||
            !Number.isFinite(amount) ||
            amount <= 0 ||
            !["income", "expense"].includes(type) ||
            typeof category !== "string" ||
            !category.trim()
        ) {
            return res.status(400).json({
                error: "Invalid transaction information"
            });
        }

        const result = db.prepare(`
            INSERT INTO transactions (description, amount, type, category)
            VALUES (?, ?, ?, ?)
        `).run(description.trim(), amount, type, category.trim());

        const transaction = db.prepare(`
            SELECT *
            FROM transactions
            WHERE transaction_id = ?
        `).get(result.lastInsertRowid);

        res.status(201).json(transaction);

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Unable to save transaction" });
    }
});

// Retrieve budgets for a specific month
app.get("/api/budgets", (req, res) => {
    try {
        const month = req.query.month;

        if (!month || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
            return res.status(400).json({
                error: "A valid month is required (YYYY-MM)"
            });
        }

        const budgets = db.prepare(`
            SELECT
                b.budget_id,
                b.category,
                b.budget_amount,
                b.budget_month,

                COALESCE(SUM(t.amount), 0) AS spent

            FROM budgets b

            LEFT JOIN transactions t
                ON t.category = b.category
                AND t.type = 'expense'
                AND substr(t.transaction_date, 1, 7) = b.budget_month

            WHERE b.budget_month = ?

            GROUP BY
                b.budget_id,
                b.category,
                b.budget_amount,
                b.budget_month

            ORDER BY b.category
        `).all(month);

        const results = budgets.map(budget => ({
            ...budget,
            remaining: budget.budget_amount - budget.spent,
            percentage_used: Math.round(
                (budget.spent / budget.budget_amount) * 100
            )
        }));

        res.json(results);

    } catch (error) {
        console.error(error);
        res.status(500).json({
            error: "Unable to retrieve budgets"
        });
    }
});

// Create a monthly budget
app.post("/api/budgets", (req, res) => {
    try {
        const {
            category,
            budget_amount,
            budget_month
        } = req.body;

        if (
            typeof category !== "string" ||
            !category.trim() ||
            typeof budget_amount !== "number" ||
            !Number.isFinite(budget_amount) ||
            budget_amount <= 0 ||
            typeof budget_month !== "string" ||
            !/^\d{4}-(0[1-9]|1[0-2])$/.test(budget_month)
        ) {
            return res.status(400).json({
                error: "Invalid budget information"
            });
        }

        const result = db.prepare(`
            INSERT INTO budgets (
                category,
                budget_amount,
                budget_month
            )
            VALUES (?, ?, ?)
        `).run(
            category.trim(),
            budget_amount,
            budget_month
        );

        const budget = db.prepare(`
            SELECT *
            FROM budgets
            WHERE budget_id = ?
        `).get(result.lastInsertRowid);

        res.status(201).json(budget);

    } catch (error) {

        if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
            return res.status(409).json({
                error: "A budget already exists for this category and month"
            });
        }

        console.error(error);

        res.status(500).json({
            error: "Unable to create budget"
        });
    }
});

// Delete a transaction by its ID
app.delete("/api/transactions/:id", (req, res) => {
    try {
        const id = Number(req.params.id);

        // Validate the transaction ID
        if (!Number.isSafeInteger(id) || id <= 0) {
            return res.status(400).json({
                error: "Invalid transaction ID"
            });
        }

        // Delete the matching transaction
        const result = db.prepare(`
            DELETE FROM transactions
            WHERE transaction_id = ?
        `).run(id);

        // Check whether a transaction was deleted
        if (result.changes === 0) {
            return res.status(404).json({
                error: "Transaction not found"
            });
        }

        res.json({
            message: "Transaction deleted successfully",
            transaction_id: id
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: "Unable to delete transaction"
        });
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`BuyNana backend running on http://localhost:${PORT}`);
});