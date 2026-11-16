const db = require("../database/db");

// Retrieve monthly income and expenses from SQLite
function getMonthlyFinancialHistory() {
    const rows = db.prepare(`
        SELECT
            substr(transaction_date, 1, 7) AS month,

            COALESCE(
                SUM(
                    CASE
                        WHEN type = 'income'
                        THEN amount
                        ELSE 0
                    END
                ),
                0
            ) AS income,

            COALESCE(
                SUM(
                    CASE
                        WHEN type = 'expense'
                        THEN amount
                        ELSE 0
                    END
                ),
                0
            ) AS expenses

        FROM transactions

        GROUP BY substr(transaction_date, 1, 7)

        ORDER BY month ASC
    `).all();

    return rows.map(row => ({
        month: row.month,
        income: row.income,
        expenses: row.expenses,
        net_cash_flow: row.income - row.expenses
    }));
}

// ============================================================
// HISTORICAL-AVERAGE FORECAST
// ============================================================

function calculateHistoricalAverageForecast(startingBalance = 0) {
    if (
        typeof startingBalance !== "number" ||
        !Number.isFinite(startingBalance)
    ) {
        throw new Error("Starting balance must be a valid number.");
    }

    const history = getMonthlyFinancialHistory();

    // Exclude the current month because it may be incomplete.
    const now = new Date();

    const currentMonth = [
        now.getFullYear(),
        String(now.getMonth() + 1).padStart(2, "0")
    ].join("-");

    const completedMonths = history.filter(
        (record) => record.month < currentMonth
    );

    // No completed historical months available.
    if (completedMonths.length === 0) {
        return {
            method: "expected_cash_flow",
            historical_months: 0,
            average_income: null,
            average_expenses: null,
            predicted_income: null,
            predicted_expenses: null,
            starting_balance: startingBalance,
            projected_ending_balance: null,
            message:
                "No completed historical months available. " +
                "Expected income and expenses are required."
        };
    }

    const totalIncome = completedMonths.reduce(
        (sum, record) => sum + record.income,
        0
    );

    const totalExpenses = completedMonths.reduce(
        (sum, record) => sum + record.expenses,
        0
    );

    const averageIncome =
        totalIncome / completedMonths.length;

    const averageExpenses =
        totalExpenses / completedMonths.length;

    const projectedEndingBalance =
        startingBalance + averageIncome - averageExpenses;

    // Round financial values for the API response.
    const roundMoney = (value) =>
        Math.round((value + Number.EPSILON) * 100) / 100;

    return {
        method: "historical_average",

        historical_months: completedMonths.length,

        average_income: roundMoney(averageIncome),
        average_expenses: roundMoney(averageExpenses),

        predicted_income: roundMoney(averageIncome),
        predicted_expenses: roundMoney(averageExpenses),

        starting_balance: roundMoney(startingBalance),

        projected_ending_balance:
            roundMoney(projectedEndingBalance)
    };
}

// ============================================================
// CALCULATE AVAILABLE BALANCE
// ============================================================

function getAvailableBalance() {
    // Calculate net income and expenses.
    const transactionTotals = db.prepare(`
        SELECT
            COALESCE(
                SUM(
                    CASE
                        WHEN type = 'income' THEN amount
                        WHEN type = 'expense' THEN -amount
                        ELSE 0
                    END
                ),
                0
            ) AS net_balance
        FROM transactions
    `).get();

    // Include contributions from both active and archived goals.
    const savingsTotals = db.prepare(`
        SELECT
            COALESCE(SUM(amount), 0) AS total_saved
        FROM savings_contributions
    `).get();

    const availableBalance =
        transactionTotals.net_balance - savingsTotals.total_saved;

    return Math.round(
        (availableBalance + Number.EPSILON) * 100
    ) / 100;
}

// ============================================================
// GENERATE FINANCIAL FORECAST
// ============================================================

// ============================================================
// GENERATE FINANCIAL FORECAST
// Historical Income + Recurring/Nonrecurring Expenses
// ============================================================

function generateFinancialForecast() {
    const startingBalance = getAvailableBalance();

    // Historical-average forecast provides income estimates.
    const historicalForecast =
        calculateHistoricalAverageForecast(startingBalance);

    // Combined model provides recurring and nonrecurring expenses.
    const expenseForecast =
        calculateCombinedExpenseForecast();

    const now = new Date();

    const forecastDate = new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        1
    );

    const forecastMonth = [
        forecastDate.getFullYear(),
        String(forecastDate.getMonth() + 1).padStart(2, "0")
    ].join("-");

    const roundMoney = (value) =>
        Math.round((value + Number.EPSILON) * 100) / 100;

    // No completed historical months means income is unknown.
    if (historicalForecast.method !== "historical_average") {
        return {
            forecast_month: forecastMonth,
            generated_at: new Date().toISOString(),

            method: "expected_cash_flow",

            historical_months: 0,

            starting_balance: startingBalance,

            predicted_income: null,

            predicted_expenses: null,

            predicted_recurring_expenses:
                expenseForecast.predicted_recurring_expenses,

            predicted_nonrecurring_expenses: null,

            projected_ending_balance: null,

            data_quality: "insufficient_history",

            message:
                "Historical income and nonrecurring spending " +
                "are insufficient for a complete forecast. " +
                "Expected income and expenses are required."
        };
    }

    const predictedIncome =
        historicalForecast.predicted_income;

    const predictedExpenses =
        expenseForecast.predicted_total_expenses;

    const projectedEndingBalance =
        startingBalance +
        predictedIncome -
        predictedExpenses;

    return {
        forecast_month: forecastMonth,

        generated_at: new Date().toISOString(),

        method: "historical_plus_recurring",

        historical_months:
            historicalForecast.historical_months,

        starting_balance:
            roundMoney(startingBalance),

        average_income:
            historicalForecast.average_income,

        average_expenses:
            historicalForecast.average_expenses,

        predicted_income:
            roundMoney(predictedIncome),

        predicted_expenses:
            roundMoney(predictedExpenses),

        predicted_recurring_expenses:
            expenseForecast.predicted_recurring_expenses,

        predicted_nonrecurring_expenses:
            expenseForecast.average_nonrecurring_expenses,

        recurring_count:
            expenseForecast.recurring_count,

        projected_ending_balance:
            roundMoney(projectedEndingBalance),

        data_quality:
            expenseForecast.data_quality,

        message:
            expenseForecast.message
    };
}

// ============================================================
// RETRIEVE RECURRING EXPENSES
// ============================================================

function getRecurringExpenses() {
    const rows = db.prepare(`
        SELECT
            transaction_id,
            description,
            category,
            amount,
            recurring_frequency,
            transaction_date

        FROM transactions

        WHERE
            type = 'expense'
            AND is_recurring = 1
            AND recurring_frequency IN (
                'weekly',
                'monthly',
                'yearly'
            )

        ORDER BY transaction_date DESC, transaction_id DESC
    `).all();

    // Keep the latest occurrence of each recurring expense.
    const uniqueExpenses = new Map();

    for (const transaction of rows) {
        const key = [
            transaction.description.trim().toLowerCase(),
            transaction.category.trim().toLowerCase()
        ].join("|");

        if (!uniqueExpenses.has(key)) {
            uniqueExpenses.set(key, transaction);
        }
    }

    return Array.from(uniqueExpenses.values());
}

// ============================================================
// NORMALIZE RECURRING EXPENSES
// ============================================================

function calculateMonthlyRecurringExpenses() {
    const recurringExpenses = getRecurringExpenses();

    const normalizedExpenses = recurringExpenses.map(
        (expense) => {
            let monthlyAmount = 0;

            switch (expense.recurring_frequency) {
                case "weekly":
                    monthlyAmount = expense.amount * 52 / 12;
                    break;

                case "monthly":
                    monthlyAmount = expense.amount;
                    break;

                case "yearly":
                    monthlyAmount = expense.amount / 12;
                    break;

                default:
                    monthlyAmount = 0;
            }

            return {
                ...expense,
                monthly_equivalent:
                    Math.round(monthlyAmount * 100) / 100
            };
        }
    );

    const totalMonthlyRecurring =
        normalizedExpenses.reduce(
            (sum, expense) =>
                sum + expense.monthly_equivalent,
            0
        );

    return {
        recurring_count: normalizedExpenses.length,
        total_monthly_recurring:
            Math.round(totalMonthlyRecurring * 100) / 100,
        expenses: normalizedExpenses
    };
}

// ============================================================
// HISTORICAL NONRECURRING EXPENSES
// ============================================================

// ============================================================
// HISTORICAL NONRECURRING EXPENSES
// INCLUDE MONTHS WITH OTHER FINANCIAL ACTIVITY
// ============================================================

function getMonthlyNonRecurringExpenses() {
    const rows = db.prepare(`
        SELECT
            substr(transaction_date, 1, 7) AS month,

            COALESCE(
                SUM(
                    CASE
                        WHEN type = 'expense'
                             AND COALESCE(is_recurring, 0) = 0
                        THEN amount
                        ELSE 0
                    END
                ),
                0
            ) AS expenses,

            COUNT(*) AS transaction_count

        FROM transactions

        WHERE
            transaction_date IS NOT NULL
            AND transaction_date GLOB
                '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'

        GROUP BY substr(transaction_date, 1, 7)

        ORDER BY month ASC
    `).all();

    return rows;
}

// ============================================================
// CALCULATE AVERAGE NONRECURRING EXPENSES
// ============================================================

// ============================================================
// CALCULATE AVERAGE NONRECURRING EXPENSES
// ============================================================

function calculateAverageNonRecurringExpenses() {
    const history = getMonthlyNonRecurringExpenses();

    const now = new Date();

    const currentMonth = [
        now.getFullYear(),
        String(now.getMonth() + 1).padStart(2, "0")
    ].join("-");

    // Exclude the current and future months.
    const completedMonths = history.filter(
        (record) => record.month < currentMonth
    );

    if (completedMonths.length === 0) {
        return {
            historical_months: 0,
            average_nonrecurring_expenses: 0,
            has_history: false,
            data_quality: "insufficient_history"
        };
    }

    const totalExpenses = completedMonths.reduce(
        (sum, record) => sum + record.expenses,
        0
    );

    const averageExpenses =
        totalExpenses / completedMonths.length;

    return {
        historical_months: completedMonths.length,

        average_nonrecurring_expenses:
            Math.round(averageExpenses * 100) / 100,

        has_history: true,

        data_quality: "activity_based",

        message:
            "The average uses completed months with recorded " +
            "financial activity. Transaction completeness " +
            "has not been verified."
    };
}

// ============================================================
// COMBINED EXPENSE FORECAST
// ============================================================

function calculateCombinedExpenseForecast() {
    const nonRecurring =
        calculateAverageNonRecurringExpenses();

    const recurring =
        calculateMonthlyRecurringExpenses();

    const predictedExpenses =
        nonRecurring.average_nonrecurring_expenses +
        recurring.total_monthly_recurring;

    return {
        method: "historical_plus_recurring",

        historical_months:
            nonRecurring.historical_months,

        average_nonrecurring_expenses:
            nonRecurring.average_nonrecurring_expenses,

        predicted_recurring_expenses:
            recurring.total_monthly_recurring,

        predicted_total_expenses:
            Math.round(predictedExpenses * 100) / 100,

        recurring_count:
            recurring.recurring_count,

        has_nonrecurring_history:
            nonRecurring.has_history,
        data_quality: nonRecurring.data_quality,

message: nonRecurring.message ??
    "Historical nonrecurring expense data is unavailable."
    };
}

module.exports = {
    getMonthlyFinancialHistory,
    calculateHistoricalAverageForecast,
    getAvailableBalance,
    generateFinancialForecast,
    getRecurringExpenses,
    calculateMonthlyRecurringExpenses,
    getMonthlyNonRecurringExpenses,
    calculateAverageNonRecurringExpenses,
    calculateCombinedExpenseForecast
};