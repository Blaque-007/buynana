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

// Start the server
app.listen(PORT, () => {
    console.log(`BuyNana backend running on http://localhost:${PORT}`);
});