const express = require("express");
const cors = require("cors");
const db = require("./database/db");
const savingsRoutes = require("./routes/savingsRoutes");
const forecastRoutes = require("./routes/forecastRoutes");
const app = express();
const PORT = 3001;

// Allow requests from React
app.use(
    cors({
        origin: "http://localhost:5173",
    })
);

// Allow JSON requests
app.use(express.json());

// Savings management endpoints
app.use("/api/savings", savingsRoutes);

// Financial forecasting endpoints
app.use("/api/forecast", forecastRoutes);
// ============================================================
// HEALTH CHECK
// ============================================================

// Test endpoint
app.get("/api/health", (req, res) => {
    res.json({
        status: "success",
        message: "BuyNana backend is running!",
    });
});


// ============================================================
// TRANSACTION ENDPOINTS
// ============================================================

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

        res.status(500).json({
            error: "Unable to retrieve transactions",
        });
    }
});


// Create a new transaction
app.post("/api/transactions", (req, res) => {
    try {
        const {
            description,
            amount,
            type,
            category,
            transaction_date,
            is_recurring = 0,
            recurring_frequency = null,
        } = req.body;

        // Validate description
        if (
            typeof description !== "string" ||
            !description.trim()
        ) {
            return res.status(400).json({
                error: "A transaction description is required",
            });
        }

        // Validate amount
        if (
            typeof amount !== "number" ||
            !Number.isFinite(amount) ||
            amount <= 0
        ) {
            return res.status(400).json({
                error: "Amount must be a positive number",
            });
        }

        // Validate transaction type
        if (!["income", "expense"].includes(type)) {
            return res.status(400).json({
                error: "Transaction type must be income or expense",
            });
        }

        // Validate category
        if (
            typeof category !== "string" ||
            !category.trim()
        ) {
            return res.status(400).json({
                error: "A transaction category is required",
            });
        }

        // Validate recurring flag
        if (![0, 1].includes(is_recurring)) {
            return res.status(400).json({
                error: "Recurring flag must be 0 or 1",
            });
        }

        // Validate recurring frequency
        const validFrequencies = [
            "weekly",
            "monthly",
            "yearly",
        ];

        if (
            is_recurring === 1 &&
            !validFrequencies.includes(recurring_frequency)
        ) {
            return res.status(400).json({
                error: "A valid recurring frequency is required",
            });
        }

        // Determine the transaction date
        let selectedDate = transaction_date;

        if (
            selectedDate === undefined ||
            selectedDate === null
        ) {
            const now = new Date();

            selectedDate = [
                now.getFullYear(),
                String(now.getMonth() + 1).padStart(2, "0"),
                String(now.getDate()).padStart(2, "0"),
            ].join("-");
        }

        // Validate YYYY-MM-DD format
        if (
            typeof selectedDate !== "string" ||
            !/^\d{4}-\d{2}-\d{2}$/.test(selectedDate)
        ) {
            return res.status(400).json({
                error: "Transaction date must use YYYY-MM-DD",
            });
        }

        // Validate actual calendar date
        const [year, month, day] = selectedDate
            .split("-")
            .map(Number);

        const parsedDate = new Date(
            Date.UTC(year, month - 1, day)
        );

        if (
            year < 1 ||
            year > 9999 ||
            parsedDate.getUTCFullYear() !== year ||
            parsedDate.getUTCMonth() !== month - 1 ||
            parsedDate.getUTCDate() !== day
        ) {
            return res.status(400).json({
                error: "Transaction date is not a valid calendar date",
            });
        }

        // Only recurring transactions should have a frequency
        const frequencyToSave =
            is_recurring === 1
                ? recurring_frequency
                : null;

        // Save transaction to SQLite
        const result = db.prepare(`
            INSERT INTO transactions (
                description,
                amount,
                type,
                category,
                transaction_date,
                is_recurring,
                recurring_frequency
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
            description.trim(),
            amount,
            type,
            category.trim(),
            selectedDate,
            is_recurring,
            frequencyToSave
        );

        // Retrieve newly created transaction
        const transaction = db.prepare(`
            SELECT *
            FROM transactions
            WHERE transaction_id = ?
        `).get(result.lastInsertRowid);

        res.status(201).json(transaction);

    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: "Unable to create transaction",
        });
    }
});


// Delete a transaction by its ID
app.delete("/api/transactions/:id", (req, res) => {
    try {
        const id = Number(req.params.id);

        // Validate transaction ID
        if (!Number.isSafeInteger(id) || id <= 0) {
            return res.status(400).json({
                error: "Invalid transaction ID",
            });
        }

        // Delete transaction from SQLite
        const result = db.prepare(`
            DELETE FROM transactions
            WHERE transaction_id = ?
        `).run(id);

        // Check if transaction existed
        if (result.changes === 0) {
            return res.status(404).json({
                error: "Transaction not found",
            });
        }

        res.json({
            message: "Transaction deleted successfully",
            transaction_id: id,
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: "Unable to delete transaction",
        });
    }
});


// ============================================================
// BUDGET ENDPOINTS
// ============================================================

// Retrieve budgets for a specific month
app.get("/api/budgets", (req, res) => {
    try {
        const month = req.query.month;

        // Validate month format
        if (
            !month ||
            !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)
        ) {
            return res.status(400).json({
                error: "A valid month is required (YYYY-MM)",
            });
        }

        // Retrieve budgets and calculate spending
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

        // Calculate remaining budget and percentage used
        const results = budgets.map((budget) => ({
            ...budget,

            remaining:
                budget.budget_amount - budget.spent,

            percentage_used: Math.round(
                (budget.spent / budget.budget_amount) * 100
            ),
        }));

        res.json(results);

    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: "Unable to retrieve budgets",
        });
    }
});


// Create a monthly budget
app.post("/api/budgets", (req, res) => {
    try {
        const {
            category,
            budget_amount,
            budget_month,
        } = req.body;

        // Validate budget information
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
                error: "Invalid budget information",
            });
        }

        // Insert budget into SQLite
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

        // Retrieve newly created budget
        const budget = db.prepare(`
            SELECT *
            FROM budgets
            WHERE budget_id = ?
        `).get(result.lastInsertRowid);

        res.status(201).json(budget);

    } catch (error) {

        // Handle duplicate category/month budgets
        if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
            return res.status(409).json({
                error: "A budget already exists for this category and month",
            });
        }

        console.error(error);

        res.status(500).json({
            error: "Unable to create budget",
        });
    }
});


// ============================================================
// START SERVER
// ============================================================

app.listen(PORT, () => {
    console.log(
        `BuyNana backend running on http://localhost:${PORT}`
    );
});