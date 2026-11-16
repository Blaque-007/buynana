const productionDb = require("../database/db");

function createSeasonalService(db = productionDb) {
  // ============================================================
  // SEASONAL FORECAST CONFIGURATION
  // ============================================================

  const MIN_HISTORY_MONTHS = 24;
  const MIN_MONTH_OBSERVATIONS = 2;

  // ============================================================
  // RETRIEVE MONTHLY NONRECURRING SPENDING BY CATEGORY
  // ============================================================

  function getMonthlyCategorySpending() {
    const rows = db
      .prepare(
        `
        SELECT
            substr(transaction_date, 1, 7) AS month,

            category,

            ROUND(SUM(amount), 2) AS total_spending

        FROM transactions

        WHERE
            type = 'expense'
            AND COALESCE(is_recurring, 0) = 0
            AND transaction_date IS NOT NULL
            AND transaction_date GLOB
                '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'

        GROUP BY
            substr(transaction_date, 1, 7),
            category

        ORDER BY
            month ASC,
            category ASC
    `,
      )
      .all();

    return rows;
  }

  // ============================================================
  // CALCULATE CATEGORY SEASONAL FACTOR
  // ============================================================

  function calculateSeasonalFactor(category, targetMonth) {
    if (typeof category !== "string" || !category.trim()) {
      throw new Error("A valid category is required.");
    }

    if (!Number.isInteger(targetMonth) || targetMonth < 1 || targetMonth > 12) {
      throw new Error("Target month must be between 1 and 12.");
    }

    const history = getMonthlyCategorySpending();

    const now = new Date();

    const currentMonth = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, "0"),
    ].join("-");

    // Exclude the current and future months.
    const completedHistory = history.filter(
      (record) => record.month < currentMonth,
    );

    // Identify completed months containing any financial activity.
    const completedActivityMonths = db
      .prepare(
        `
        SELECT DISTINCT
            substr(transaction_date, 1, 7) AS month

        FROM transactions

        WHERE
            transaction_date IS NOT NULL
            AND transaction_date GLOB
                '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
            AND substr(transaction_date, 1, 7) < ?

        ORDER BY month
    `,
      )
      .all(currentMonth);

    const historyMonths = completedActivityMonths.length;

    // Count recorded months by calendar year.
    const monthsByYear = new Map();

    for (const record of completedActivityMonths) {
      const year = record.month.slice(0, 4);

      if (!monthsByYear.has(year)) {
        monthsByYear.set(year, new Set());
      }

      monthsByYear.get(year).add(record.month.slice(5, 7));
    }

    // Require at least two years containing all 12 months.
    const completeYears = Array.from(monthsByYear.values()).filter(
      (months) => months.size === 12,
    ).length;

    // Default response when seasonality cannot be established.
    const neutralResult = {
      category,
      target_month: targetMonth,
      seasonal_factor: 1.0,
      historical_months: historyMonths,
      matching_month_observations: 0,
      sufficient_history: false,
      method: "neutral",
    };

    if (historyMonths < MIN_HISTORY_MONTHS || completeYears < 2) {
      return neutralResult;
    }

    const categoryHistory = completedHistory.filter(
      (record) =>
        record.category.toLowerCase() === category.trim().toLowerCase(),
    );

    if (categoryHistory.length === 0) {
      return neutralResult;
    }

    const categoryMonthlyTotals = new Map(
      categoryHistory.map((record) => [record.month, record.total_spending]),
    );

    // Include recorded zero-spending months in the category baseline.
    const monthlyAmounts = completedActivityMonths.map(
      (record) => categoryMonthlyTotals.get(record.month) ?? 0,
    );

    const overallAverage =
      monthlyAmounts.reduce((sum, amount) => sum + amount, 0) /
      monthlyAmounts.length;

    if (overallAverage <= 0) {
      return neutralResult;
    }

    const matchingMonths = completedActivityMonths.filter(
      (record) => Number(record.month.slice(5, 7)) === targetMonth,
    );

    if (matchingMonths.length < MIN_MONTH_OBSERVATIONS) {
      return {
        ...neutralResult,
        matching_month_observations: matchingMonths.length,
      };
    }

    const matchingAmounts = matchingMonths.map(
      (record) => categoryMonthlyTotals.get(record.month) ?? 0,
    );

    const matchingAverage =
      matchingAmounts.reduce((sum, amount) => sum + amount, 0) /
      matchingAmounts.length;

    const seasonalFactor = matchingAverage / overallAverage;

    return {
      category,
      target_month: targetMonth,

      seasonal_factor: Math.round(seasonalFactor * 1000) / 1000,

      historical_months: historyMonths,

      matching_month_observations: matchingMonths.length,

      sufficient_history: true,

      method: "calendar_month_average",
    };
  }
  return {
    getMonthlyCategorySpending,
    calculateSeasonalFactor,
  };
}

module.exports = {
  ...createSeasonalService(),
  createSeasonalService,
};
