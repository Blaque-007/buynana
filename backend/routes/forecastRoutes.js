const express = require("express");

const forecastService = require("../services/forecastService");

const {
    getMonthlyFinancialHistory,
    generateFinancialForecast
} = require("../services/forecastService");

const router = express.Router();

// ============================================================
// GET MONTHLY FINANCIAL HISTORY
// ============================================================

router.get("/history", (req, res) => {
    try {
        const history = getMonthlyFinancialHistory();

        res.json({
            success: true,
            count: history.length,
            data: history
        });

    } catch (error) {
        console.error("Forecast history error:", error);

        res.status(500).json({
            success: false,
            error: "Unable to retrieve financial history"
        });
    }
});

// ============================================================
// GET FINANCIAL FORECAST
// ============================================================

router.get("/prediction", (req, res) => {
    try {
        const forecast = generateFinancialForecast();

        res.json({
            success: true,
            data: forecast
        });

    } catch (error) {
        console.error("Forecast prediction error:", error);

        res.status(500).json({
            success: false,
            error: "Unable to generate financial forecast"
        });
    }
});

// ============================================================
// GET AUTOMATIC FORECAST SUGGESTIONS
// ============================================================

router.get("/suggestions", (req, res) => {
    try {
        const suggestions =
            forecastService.getForecastSuggestions();

        res.status(200).json({
            success: true,
            data: suggestions
        });

    } catch (error) {
        console.error(
            "Forecast suggestions error:",
            error
        );

        res.status(500).json({
            success: false,
            error: "Unable to retrieve forecast suggestions."
        });
    }
});

// ============================================================
// POST HYBRID FORECAST
// ============================================================

router.post("/hybrid", (req, res) => {
    try {
        const {
            expectedIncome = null,
            expectedExpenses = null
        } = req.body ?? {};

        const isValidAmount = value =>
            typeof value === "number" &&
            Number.isFinite(value) &&
            value >= 0;

        if (
            (expectedIncome !== null &&
                !isValidAmount(expectedIncome)) ||
            (expectedExpenses !== null &&
                !isValidAmount(expectedExpenses))
        ) {
            return res.status(400).json({
                success: false,
                error:
                    "Expected income and expenses must be non-negative numbers or null."
            });
        }

        const forecast =
            forecastService.calculateHybridForecast({
                expectedIncome,
                expectedExpenses
            });

        return res.status(200).json({
            success: true,
            data: forecast
        });

    } catch (error) {
        console.error(
            "Hybrid forecast error:",
            error
        );

        return res.status(500).json({
            success: false,
            error: "Unable to calculate hybrid forecast."
        });
    }
});

module.exports = router;