import { useEffect, useState } from "react";

import SavingsGoals from "../components/SavingsGoals";

import {
    getForecastSuggestions,
    generateHybridForecast
} from "../services/forecastService";

import "./Forecast.css";

function Forecast() {
    const [suggestions, setSuggestions] = useState(null);
    const [forecast, setForecast] = useState(null);

    const [expectedIncome, setExpectedIncome] = useState("");
    const [expectedExpenses, setExpectedExpenses] = useState("");

    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [error, setError] = useState("");

    // Load automatic suggestions when the page opens.
    useEffect(() => {
        async function loadSuggestions() {
            try {
                setLoading(true);
                setError("");

                const data = await getForecastSuggestions();

                setSuggestions(data);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        }

        loadSuggestions();
    }, []);

    // Convert a user-entered amount to a number.
    // Empty input means "use automatic suggestion".
    function parseOverride(value) {
        if (value.trim() === "") {
            return null;
        }

        return Number(value);
    }

    // Generate a forecast.
    async function handleGenerateForecast(event) {
        event.preventDefault();

        try {
            setGenerating(true);
            setError("");

            const result = await generateHybridForecast({
                expectedIncome: parseOverride(expectedIncome),
                expectedExpenses: parseOverride(expectedExpenses)
            });

            setForecast(result);
        } catch (err) {
            setError(err.message);
        } finally {
            setGenerating(false);
        }
    }

    function formatCurrency(amount) {
        if (amount === null || amount === undefined) {
            return "Not available";
        }

        return new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD"
        }).format(amount);
    }

    return (
        <div className="forecast-page">
            <header className="forecast-header">
                <h1>Forecast</h1>
                <p>
                    Plan your financial future and track your savings goals.
                </p>
            </header>

            <section className="forecast-panel">
                <div className="forecast-panel-heading">
                    <div>
                        <h2>Financial Forecast</h2>
                        <p>
                            Review your financial expectations and
                            calculate your projected balance.
                        </p>
                    </div>

                    {suggestions && (
                        <span className="forecast-month">
                            {suggestions.forecast_month}
                        </span>
                    )}
                </div>

                {loading ? (
                    <p>Loading financial suggestions...</p>
                ) : (
                    <>
                        {suggestions && (
                            <div className="forecast-suggestions">
                                <div className="forecast-suggestion-card">
                                    <span>Starting Balance</span>

                                    <strong>
                                        {formatCurrency(
                                            suggestions.starting_balance
                                        )}
                                    </strong>
                                </div>

                                <div className="forecast-suggestion-card">
                                    <span>Suggested Income</span>

                                    <strong>
                                        {formatCurrency(
                                            suggestions.income.suggested_amount
                                        )}
                                    </strong>

                                    <small>
                                        Source: {suggestions.income.source}
                                    </small>
                                </div>

                                <div className="forecast-suggestion-card">
                                    <span>Suggested Expenses</span>

                                    <strong>
                                        {formatCurrency(
                                            suggestions.expenses.suggested_amount
                                        )}
                                    </strong>

                                    <small>
                                        Source: {suggestions.expenses.source}
                                    </small>
                                </div>
                            </div>
                        )}

                        <form
                            className="forecast-form"
                            onSubmit={handleGenerateForecast}
                        >
                            <div className="forecast-input-group">
                                <label htmlFor="expectedIncome">
                                    Expected Monthly Income
                                </label>

                                <input
                                    id="expectedIncome"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    placeholder="Use automatic suggestion"
                                    value={expectedIncome}
                                    onChange={(event) =>
                                        setExpectedIncome(event.target.value)
                                    }
                                />

                                <small>
                                    Leave blank to use the automatic estimate.
                                </small>
                            </div>

                            <div className="forecast-input-group">
                                <label htmlFor="expectedExpenses">
                                    Expected Monthly Expenses
                                </label>

                                <input
                                    id="expectedExpenses"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    placeholder="Use automatic suggestion"
                                    value={expectedExpenses}
                                    onChange={(event) =>
                                        setExpectedExpenses(event.target.value)
                                    }
                                />

                                <small>
                                    Include recurring expenses in your total.
                                </small>
                            </div>

                            {suggestions?.expenses.source === "monthly_budget" && (
                                <p className="forecast-warning">
                                    Your expense suggestion is based on
                                    recorded monthly budgets and may not
                                    include all expected expenses.
                                </p>
                            )}

                            <button
                                type="submit"
                                className="forecast-generate-button"
                                disabled={generating}
                            >
                                {generating
                                    ? "Generating..."
                                    : "Generate Forecast"}
                            </button>
                        </form>
                    </>
                )}

                {error && (
                    <p className="forecast-error" role="alert">
                        {error}
                    </p>
                )}

                {forecast && (
                    <div className="forecast-results">
                        <h3>Forecast Results</h3>

                        {forecast.requires_user_input ? (
                            <p className="forecast-warning">
                                Additional financial information is required
                                to calculate your projected balance.
                            </p>
                        ) : (
                            <div className="forecast-results-grid">
                                <div className="forecast-result-card">
                                    <span>Predicted Income</span>
                                    <strong>
                                        {formatCurrency(
                                            forecast.predicted_income
                                        )}
                                    </strong>
                                </div>

                                <div className="forecast-result-card">
                                    <span>Predicted Expenses</span>
                                    <strong>
                                        {formatCurrency(
                                            forecast.predicted_expenses
                                        )}
                                    </strong>
                                </div>

                                <div className="forecast-result-card forecast-balance">
                                    <span>Projected Ending Balance</span>
                                    <strong>
                                        {formatCurrency(
                                            forecast.projected_ending_balance
                                        )}
                                    </strong>
                                </div>
                            </div>
                        )}

                        <p className="forecast-method">
                            Income source: {forecast.income_source}
                            <br />
                            Expense source: {forecast.expense_source}
                        </p>
                    </div>
                )}
            </section>

            <section className="forecast-savings-section">
                <SavingsGoals />
            </section>
        </div>
    );
}

export default Forecast;