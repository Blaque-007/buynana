const express = require("express");

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

module.exports = router;