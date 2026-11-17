// ============================================================
// BUYNANA FORECAST API SERVICE
// ============================================================

const API_BASE_URL = "/api/forecast";

// ============================================================
// HANDLE API RESPONSES
// ============================================================

async function handleResponse(response) {
    const result = await response.json();

    if (!response.ok || !result.success) {
        throw new Error(
            result.error || "Forecast request failed."
        );
    }

    return result.data;
}

// ============================================================
// GET AUTOMATIC FORECAST SUGGESTIONS
// ============================================================

export async function getForecastSuggestions() {
    const response = await fetch(
        `${API_BASE_URL}/suggestions`
    );

    return handleResponse(response);
}

// ============================================================
// GENERATE HYBRID FORECAST
// ============================================================

export async function generateHybridForecast({
    expectedIncome = null, expectedExpenses = null, expectedSavings = null,
    confirmBudget = false, months = 3
} = {}) {
    const response = await fetch(`${API_BASE_URL}/hybrid`, {
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({expectedIncome,expectedExpenses,expectedSavings,confirmBudget,months})
    });
    return handleResponse(response);
}

// ============================================================
// GET EXISTING AUTOMATIC PREDICTION
// ============================================================

export async function getAutomaticForecast() {
    const response = await fetch(
        `${API_BASE_URL}/prediction`
    );

    return handleResponse(response);
}