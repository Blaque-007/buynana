const express = require("express");
const db = require("../database/db");

const router = express.Router();

// ============================================================
// HELPERS
// ============================================================

function isValidAmount(value) {
    return (
        typeof value === "number" &&
        Number.isFinite(value) &&
        value > 0
    );
}

function isValidId(value) {
    const id = Number(value);

    return Number.isSafeInteger(id) && id > 0;
}

// Retrieve goals with calculated savings progress
function getGoals(includeArchived = false) {
    const whereClause = includeArchived
        ? ""
        : "WHERE g.is_archived = 0";

    return db.prepare(`
        SELECT
            g.goal_id,
            g.goal_name,
            g.target_amount,
            g.created_at,
            g.is_archived,

            COALESCE(SUM(c.amount), 0) AS saved_amount

        FROM savings_goals g

        LEFT JOIN savings_contributions c
            ON c.goal_id = g.goal_id

        ${whereClause}

        GROUP BY g.goal_id

        ORDER BY g.created_at DESC, g.goal_id DESC
    `).all().map(goal => ({
        ...goal,
        remaining_amount: Math.max(
            0,
            goal.target_amount - goal.saved_amount
        ),
        progress_percentage:
            (goal.saved_amount / goal.target_amount) * 100
    }));
}

// ============================================================
// GET SAVINGS GOALS
// ============================================================

router.get("/goals", (req, res) => {
    try {
        const goals = getGoals();

        res.json(goals);

    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: "Unable to retrieve savings goals"
        });
    }
});

// ============================================================
// CREATE SAVINGS GOAL
// ============================================================

router.post("/goals", (req, res) => {
    try {
        const { goal_name, target_amount } = req.body;

        if (
            typeof goal_name !== "string" ||
            !goal_name.trim() ||
            !isValidAmount(target_amount)
        ) {
            return res.status(400).json({
                error: "A goal name and positive target amount are required"
            });
        }

        const result = db.prepare(`
            INSERT INTO savings_goals (
                goal_name,
                target_amount
            )
            VALUES (?, ?)
        `).run(
            goal_name.trim(),
            target_amount
        );

        const goal = getGoals().find(
            item => item.goal_id === Number(result.lastInsertRowid)
        );

        res.status(201).json(goal);

    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: "Unable to create savings goal"
        });
    }
});

// ============================================================
// EDIT SAVINGS GOAL
// ============================================================

router.put("/goals/:id", (req, res) => {
    try {
        if (!isValidId(req.params.id)) {
            return res.status(400).json({
                error: "Invalid savings goal ID"
            });
        }

        const id = Number(req.params.id);
        const { goal_name, target_amount } = req.body;

        if (
            typeof goal_name !== "string" ||
            !goal_name.trim() ||
            !isValidAmount(target_amount)
        ) {
            return res.status(400).json({
                error: "Invalid savings goal information"
            });
        }

        const existing = db.prepare(`
            SELECT goal_id
            FROM savings_goals
            WHERE goal_id = ? AND is_archived = 0
        `).get(id);

        if (!existing) {
            return res.status(404).json({
                error: "Savings goal not found"
            });
        }

        const saved = db.prepare(`
            SELECT COALESCE(SUM(amount), 0) AS total
            FROM savings_contributions
            WHERE goal_id = ?
        `).get(id).total;

        if (target_amount < saved) {
            return res.status(400).json({
                error: "Target amount cannot be less than money already saved"
            });
        }

        db.prepare(`
            UPDATE savings_goals
            SET goal_name = ?, target_amount = ?
            WHERE goal_id = ?
        `).run(
            goal_name.trim(),
            target_amount,
            id
        );

        const goal = getGoals().find(
            item => item.goal_id === id
        );

        res.json(goal);

    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: "Unable to update savings goal"
        });
    }
});

// ============================================================
// ARCHIVE SAVINGS GOAL
// ============================================================

router.delete("/goals/:id", (req, res) => {
    try {
        if (!isValidId(req.params.id)) {
            return res.status(400).json({
                error: "Invalid savings goal ID"
            });
        }

        const id = Number(req.params.id);

        const result = db.prepare(`
            UPDATE savings_goals
            SET is_archived = 1
            WHERE goal_id = ? AND is_archived = 0
        `).run(id);

        if (result.changes === 0) {
            return res.status(404).json({
                error: "Savings goal not found"
            });
        }

        res.json({
            message: "Savings goal archived successfully",
            goal_id: id
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: "Unable to archive savings goal"
        });
    }
});

// ============================================================
// ADD SAVINGS CONTRIBUTION
// ============================================================

router.post("/goals/:id/contributions", (req, res) => {
    try {
        if (!isValidId(req.params.id)) {
            return res.status(400).json({
                error: "Invalid savings goal ID"
            });
        }

        const id = Number(req.params.id);
        const { amount } = req.body;

        if (!isValidAmount(amount)) {
            return res.status(400).json({
                error: "Contribution must be a positive amount"
            });
        }

        // Use a database transaction so the balance check and
        // contribution insertion happen together.
        const saveContribution = db.transaction(() => {

            const goal = db.prepare(`
                SELECT goal_id, target_amount
                FROM savings_goals
                WHERE goal_id = ? AND is_archived = 0
            `).get(id);

            if (!goal) {
                return {
                    status: 404,
                    error: "Savings goal not found"
                };
            }

            const saved = db.prepare(`
                SELECT COALESCE(SUM(amount), 0) AS total
                FROM savings_contributions
                WHERE goal_id = ?
            `).get(id).total;

            if (saved + amount > goal.target_amount) {
                return {
                    status: 400,
                    error: "Contribution exceeds the remaining goal amount"
                };
            }

            // Calculate available balance across all transactions
            const finances = db.prepare(`
                SELECT
                    COALESCE(
                        SUM(
                            CASE
                                WHEN type = 'income' THEN amount
                                ELSE -amount
                            END
                        ), 0
                    ) AS net_amount
                FROM transactions
            `).get();

            // All savings contributions, including archived goals,
            // remain allocated and reduce available balance.
            const savings = db.prepare(`
                SELECT COALESCE(SUM(amount), 0) AS total
                FROM savings_contributions
            `).get();

            const availableBalance =
                finances.net_amount - savings.total;

            if (amount > availableBalance) {
                return {
                    status: 400,
                    error: "Insufficient available balance"
                };
            }

            const result = db.prepare(`
                INSERT INTO savings_contributions (
                    goal_id,
                    amount
                )
                VALUES (?, ?)
            `).run(id, amount);

            return {
                status: 201,
                contribution_id: Number(result.lastInsertRowid),
                goal_id: id,
                amount
            };
        });

        const result = saveContribution();

        if (result.error) {
            return res.status(result.status).json({
                error: result.error
            });
        }

        res.status(201).json(result);

    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: "Unable to add savings contribution"
        });
    }
});

// ============================================================
// GET SAVINGS SUMMARY
// ============================================================

router.get("/summary", (req, res) => {
    try {
        const month = req.query.month;

        if (
            typeof month !== "string" ||
            !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)
        ) {
            return res.status(400).json({
                error: "A valid month is required (YYYY-MM)"
            });
        }

        // Include contributions from archived goals
        const savings = db.prepare(`
            SELECT
                COALESCE(SUM(amount), 0) AS total_saved,

                COALESCE(
                    SUM(
                        CASE
                            WHEN substr(contribution_date, 1, 7) = ?
                            THEN amount
                            ELSE 0
                        END
                    ),
                    0
                ) AS monthly_saved

            FROM savings_contributions
        `).get(month);

        res.json(savings);

    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: "Unable to retrieve savings summary"
        });
    }
});

module.exports = router;