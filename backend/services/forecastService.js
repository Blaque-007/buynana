const db = require("../database/db");

const {
    calculateSeasonalFactor
} = require("./seasonalService");

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

// ============================================================
// GENERATE FINANCIAL FORECAST
// Historical Income + Seasonal Expenses + Recurring Expenses
// ============================================================

function generateFinancialForecast() {
    const startingBalance = getAvailableBalance();

    // Retrieve historical income prediction.
    const historicalForecast =
        calculateHistoricalAverageForecast(startingBalance);

    const now = new Date();

    // Forecast the next calendar month.
    const forecastDate = new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        1
    );

    const forecastMonth = [
        forecastDate.getFullYear(),
        String(forecastDate.getMonth() + 1).padStart(2, "0")
    ].join("-");

    const targetMonth = forecastDate.getMonth() + 1;

    // Retrieve seasonally adjusted expenses.
    const expenseForecast =
        calculateSeasonallyAdjustedExpenses(targetMonth);

    const roundMoney = value =>
        Math.round((value + Number.EPSILON) * 100) / 100;

    // Determine whether historical data supports a complete forecast.
    const hasHistoricalIncome =
        historicalForecast.method === "historical_average";

    const hasNonRecurringHistory =
        expenseForecast.historical_months > 0;

    // Without historical income or nonrecurring spending,
    // we cannot generate a complete prediction.
    if (!hasHistoricalIncome || !hasNonRecurringHistory) {
        return {
            forecast_month: forecastMonth,
            generated_at: new Date().toISOString(),

            method: "expected_cash_flow",

            historical_months:
                expenseForecast.historical_months,

            starting_balance: roundMoney(startingBalance),

            predicted_income: null,
            predicted_expenses: null,

            predicted_recurring_expenses:
                expenseForecast.predicted_recurring_expenses,

            predicted_nonrecurring_expenses: null,

            projected_ending_balance: null,

            categories: expenseForecast.categories,

            data_quality: "insufficient_history",

            message:
                "Insufficient completed historical data. " +
                "Expected income and expenses are required " +
                "to generate a complete forecast."
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

    // Check whether any category has a reliable seasonal factor.
    const seasonalAdjustmentsApplied =
        expenseForecast.categories.some(
            category =>
                category.sufficient_seasonal_history &&
                category.seasonal_factor !== 1
        );

    return {
        forecast_month: forecastMonth,
        generated_at: new Date().toISOString(),

        method: seasonalAdjustmentsApplied
            ? "seasonally_adjusted"
            : "historical_plus_recurring",

        historical_months:
            expenseForecast.historical_months,

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
            expenseForecast.predicted_nonrecurring_expenses,

        recurring_count:
            expenseForecast.recurring_count,

        projected_ending_balance:
            roundMoney(projectedEndingBalance),

        seasonal_adjustments_applied:
            seasonalAdjustmentsApplied,

        categories:
            expenseForecast.categories,

        data_quality:
            expenseForecast.data_quality,

        message: seasonalAdjustmentsApplied
            ? "Seasonal adjustments were applied using historical spending patterns."
            : "Insufficient seasonal history. Neutral seasonal factors were used."
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

// ============================================================
// HISTORICAL NONRECURRING SPENDING BY CATEGORY
// ============================================================

function getAverageNonRecurringExpensesByCategory() {
    const now = new Date();

    const currentMonth = [
        now.getFullYear(),
        String(now.getMonth() + 1).padStart(2, "0")
    ].join("-");

    // Identify completed months containing financial activity.
    const activityMonths = db.prepare(`
        SELECT DISTINCT
            substr(transaction_date, 1, 7) AS month

        FROM transactions

        WHERE
            transaction_date IS NOT NULL
            AND transaction_date GLOB
                '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
            AND substr(transaction_date, 1, 7) < ?

        ORDER BY month ASC
    `).all(currentMonth);

    const monthCount = activityMonths.length;

    if (monthCount === 0) {
        return {
            historical_months: 0,
            categories: []
        };
    }

    // Retrieve nonrecurring spending totals by category.
    const categoryTotals = db.prepare(`
        SELECT
            category,

            COALESCE(SUM(amount), 0) AS total_spending

        FROM transactions

        WHERE
            type = 'expense'
            AND COALESCE(is_recurring, 0) = 0
            AND transaction_date IS NOT NULL
            AND transaction_date GLOB
                '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
            AND substr(transaction_date, 1, 7) < ?

        GROUP BY category

        ORDER BY category ASC
    `).all(currentMonth);

    const roundMoney = value =>
        Math.round((value + Number.EPSILON) * 100) / 100;

    const categories = categoryTotals.map(record => ({
        category: record.category,

        total_spending:
            roundMoney(record.total_spending),

        average_monthly_spending:
            roundMoney(record.total_spending / monthCount)
    }));

    return {
        historical_months: monthCount,
        categories
    };
}

// ============================================================
// SEASONALLY ADJUSTED EXPENSE FORECAST
// ============================================================

function calculateSeasonallyAdjustedExpenses(targetMonth) {

    if (
        !Number.isInteger(targetMonth) ||
        targetMonth < 1 ||
        targetMonth > 12
    ) {
        throw new Error("Target month must be between 1 and 12.");
    }

    const categoryHistory =
        getAverageNonRecurringExpensesByCategory();

    const recurring =
        calculateMonthlyRecurringExpenses();

    const roundMoney = value =>
        Math.round((value + Number.EPSILON) * 100) / 100;

    // Apply a seasonal factor to each nonrecurring category.
    const adjustedCategories =
        categoryHistory.categories.map(record => {

            const seasonal = calculateSeasonalFactor(
                record.category,
                targetMonth
            );

            const adjustedAmount =
                record.average_monthly_spending *
                seasonal.seasonal_factor;

            return {
                category: record.category,

                historical_average:
                    record.average_monthly_spending,

                seasonal_factor:
                    seasonal.seasonal_factor,

                predicted_spending:
                    roundMoney(adjustedAmount),

                sufficient_seasonal_history:
                    seasonal.sufficient_history
            };
        });

    const predictedNonRecurring =
        adjustedCategories.reduce(
            (sum, category) =>
                sum + category.predicted_spending,
            0
        );

    const predictedRecurring =
        recurring.total_monthly_recurring;

    const predictedTotal =
        predictedNonRecurring + predictedRecurring;

    return {
        method: "seasonally_adjusted",

        target_month: targetMonth,

        historical_months:
            categoryHistory.historical_months,

        predicted_nonrecurring_expenses:
            roundMoney(predictedNonRecurring),

        predicted_recurring_expenses:
            roundMoney(predictedRecurring),

        predicted_total_expenses:
            roundMoney(predictedTotal),

        recurring_count:
            recurring.recurring_count,

        categories:
            adjustedCategories,

        data_quality:
            categoryHistory.historical_months === 0
                ? "insufficient_history"
                : "activity_based"
    };
}

// ============================================================
// EXPECTED CASH FLOW FORECAST
// Used when historical data is insufficient
// ============================================================

function calculateExpectedCashFlow({
    startingBalance = 0,
    expectedIncome,
    expectedExpenses
}) {

    const isValidAmount = value =>
        typeof value === "number" &&
        Number.isFinite(value) &&
        value >= 0;

    if (
        !isValidAmount(startingBalance)
    ) {
        throw new Error(
            "Starting balance must be a non-negative number."
        );
    }

    if (
        !isValidAmount(expectedIncome)
    ) {
        throw new Error(
            "Expected income must be a non-negative number."
        );
    }

    if (
        !isValidAmount(expectedExpenses)
    ) {
        throw new Error(
            "Expected expenses must be a non-negative number."
        );
    }

    const roundMoney = value =>
        Math.round((value + Number.EPSILON) * 100) / 100;

    const projectedEndingBalance =
        startingBalance +
        expectedIncome -
        expectedExpenses;

    return {
        method: "expected_cash_flow",

        starting_balance:
            roundMoney(startingBalance),

        predicted_income:
            roundMoney(expectedIncome),

        predicted_expenses:
            roundMoney(expectedExpenses),

        projected_ending_balance:
            roundMoney(projectedEndingBalance),

        data_quality: "user_provided",

        message:
            "Forecast calculated using expected income and expenses."
    };
}

// ============================================================
// HYBRID FORECAST SUGGESTIONS
// ============================================================

function getForecastSuggestions() {

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

    // Retrieve the current available balance.
    const startingBalance = getAvailableBalance();

    // Retrieve historical income information.
    const historical =
        calculateHistoricalAverageForecast(startingBalance);

    // Retrieve budgets for the forecast month.
    const budgets = db.prepare(`
        SELECT
            category,
            budget_amount,
            budget_month

        FROM budgets

        WHERE budget_month = ?

        ORDER BY category ASC
    `).all(forecastMonth);

    // Calculate the total budget for the forecast month.
    const totalBudget = budgets.reduce(
        (sum, budget) => sum + budget.budget_amount,
        0
    );

    // Retrieve recurring expenses.
    const recurring =
        calculateMonthlyRecurringExpenses();

    // Determine whether historical income is available.
    const hasHistoricalIncome =
        historical.method === "historical_average" &&
        historical.predicted_income !== null;

    const suggestedIncome = hasHistoricalIncome
        ? historical.predicted_income
        : null;

    // Budgets are suggestions, not confirmed expenses.
    const suggestedExpenses = budgets.length > 0
        ? totalBudget
        : null;

    return {
        forecast_month: forecastMonth,

        starting_balance: startingBalance,

        income: {
            suggested_amount: suggestedIncome,

            source: hasHistoricalIncome
                ? "historical_average"
                : "manual_input_required",

            available: hasHistoricalIncome
        },

        expenses: {
            suggested_amount: suggestedExpenses,

            source: budgets.length > 0
                ? "monthly_budget"
                : "manual_input_required",

            available: budgets.length > 0,

            budgets: budgets
        },

        recurring_expenses: {
            monthly_equivalent:
                recurring.total_monthly_recurring,

            recurring_count:
                recurring.recurring_count,

            available:
                recurring.recurring_count > 0
        },

        requires_user_input:
            !hasHistoricalIncome ||
            budgets.length === 0
    };
}

// ============================================================
// HYBRID FORECAST WITH MANUAL OVERRIDES
// ============================================================

function calculateHybridForecast({
    expectedIncome = null,
    expectedExpenses = null
} = {}) {

    const suggestions = getForecastSuggestions();

    const isValidAmount = value =>
        typeof value === "number" &&
        Number.isFinite(value) &&
        value >= 0;

    // Null means no manual override was provided.
    // Zero is a valid manual override.
    if (
        expectedIncome !== null &&
        !isValidAmount(expectedIncome)
    ) {
        throw new Error(
            "Expected income must be a non-negative number."
        );
    }

    if (
        expectedExpenses !== null &&
        !isValidAmount(expectedExpenses)
    ) {
        throw new Error(
            "Expected expenses must be a non-negative number."
        );
    }

    // Retrieve the existing historical/seasonal forecast.
    const automaticForecast = generateFinancialForecast();

    const hasAutomaticForecast =
        automaticForecast.projected_ending_balance !== null &&
        automaticForecast.predicted_income !== null &&
        automaticForecast.predicted_expenses !== null;

    // Income priority:
    // Manual override -> automatic forecast -> suggestion.
    const predictedIncome =
        expectedIncome !== null
            ? expectedIncome
            : hasAutomaticForecast
                ? automaticForecast.predicted_income
                : suggestions.income.suggested_amount;

    // Expense priority:
    // Manual override -> automatic forecast -> budget suggestion.
    const predictedExpenses =
        expectedExpenses !== null
            ? expectedExpenses
            : hasAutomaticForecast
                ? automaticForecast.predicted_expenses
                : suggestions.expenses.suggested_amount;

    const incomeSource =
        expectedIncome !== null
            ? "manual_override"
            : hasAutomaticForecast
                ? "automatic_forecast"
                : suggestions.income.source;

    const expenseSource =
        expectedExpenses !== null
            ? "manual_override"
            : hasAutomaticForecast
                ? "automatic_forecast"
                : suggestions.expenses.source;

    const requiresUserInput =
        predictedIncome === null ||
        predictedExpenses === null;

    if (requiresUserInput) {
        return {
            forecast_month: suggestions.forecast_month,

            method: "hybrid_forecast",

            starting_balance:
                suggestions.starting_balance,

            predicted_income: predictedIncome,
            predicted_expenses: predictedExpenses,

            projected_ending_balance: null,

            income_source: incomeSource,
            expense_source: expenseSource,

            requires_user_input: true,

            message:
                "Additional expected income or expense information is required."
        };
    }

    const result = calculateExpectedCashFlow({
        startingBalance: suggestions.starting_balance,
        expectedIncome: predictedIncome,
        expectedExpenses: predictedExpenses
    });

    return {
        ...result,

        forecast_month: suggestions.forecast_month,

        method: "hybrid_forecast",

        income_source: incomeSource,
        expense_source: expenseSource,

        requires_user_input: false,

        seasonal_adjustments_applied:
            hasAutomaticForecast
                ? automaticForecast.seasonal_adjustments_applied
                : false,

        message:
            "Forecast calculated using automatic suggestions and/or manual overrides."
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
    calculateCombinedExpenseForecast,
    getAverageNonRecurringExpensesByCategory,
    calculateSeasonallyAdjustedExpenses,
    calculateExpectedCashFlow,
    getForecastSuggestions,
    calculateHybridForecast
};