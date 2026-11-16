import { useEffect, useState } from "react";
import { getBudgets, addBudget } from "../services/budgetService";

import "./Budgets.css";

// Get the current month in YYYY-MM format
function getCurrentMonth() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");

    return `${year}-${month}`;
}

function Budgets() {
    const [month, setMonth] = useState(getCurrentMonth());
    const [budgets, setBudgets] = useState([]);

    const [formData, setFormData] = useState({
        category: "Food",
        budget_amount: ""
    });

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    // Load budgets whenever the selected month changes
    useEffect(() => {
        let cancelled = false;

        async function loadBudgets() {
            setLoading(true);
            setError("");

            try {
                const data = await getBudgets(month);

                if (!cancelled) {
                    setBudgets(data);
                }
            } catch (err) {
                if (!cancelled) {
                    setError(err.message);
                    setBudgets([]);
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        }

        loadBudgets();

        return () => {
            cancelled = true;
        };
    }, [month]);

    // Format amounts as USD
    function formatCurrency(amount) {
        return new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD"
        }).format(amount);
    }

    // Handle form changes
    function handleChange(event) {
        const { name, value } = event.target;

        setFormData(previous => ({
            ...previous,
            [name]: value
        }));
    }

    // Create a budget
    async function handleSubmit(event) {
        event.preventDefault();

        if (saving) return;

        setError("");
        setSuccess("");

        const amount = Number(formData.budget_amount);

        if (!Number.isFinite(amount) || amount <= 0) {
            setError("Enter a valid budget amount greater than zero.");
            return;
        }

        setSaving(true);

        try {
            await addBudget({
                category: formData.category,
                budget_amount: amount,
                budget_month: month
            });

            setSuccess("Budget created successfully!");

            setFormData(previous => ({
                ...previous,
                budget_amount: ""
            }));

            // Refresh the displayed budgets
            const updatedBudgets = await getBudgets(month);
            setBudgets(updatedBudgets);

        } catch (err) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    }

    // Calculate overall budget totals
    const totalBudget = budgets.reduce(
        (total, budget) => total + budget.budget_amount,
        0
    );

    const totalSpent = budgets.reduce(
        (total, budget) => total + budget.spent,
        0
    );

    const totalRemaining = totalBudget - totalSpent;

    return (
        <div className="budgets-page">

            <div className="budgets-header">
                <div>
                    <h1>Budgets</h1>
                    <p>Manage your monthly spending limits</p>
                </div>

                <input
                    type="month"
                    value={month}
                    onChange={event => {
                        setMonth(event.target.value);
                        setSuccess("");
                    }}
                    aria-label="Select budget month"
                />
            </div>

            {error && (
                <p className="budgets-error" role="alert">
                    {error}
                </p>
            )}

            {success && (
                <p className="budgets-success" role="status">
                    {success}
                </p>
            )}

            <section className="budgets-summary">

                <div className="budget-summary-card">
                    <span>Total Budget</span>
                    <strong>{formatCurrency(totalBudget)}</strong>
                </div>

                <div className="budget-summary-card">
                    <span>Total Spent</span>
                    <strong>{formatCurrency(totalSpent)}</strong>
                </div>

                <div className="budget-summary-card">
                    <span>Remaining</span>
                    <strong>{formatCurrency(totalRemaining)}</strong>
                </div>

            </section>

            <section className="budget-form-panel">
                <h2>Create Monthly Budget</h2>

                <form onSubmit={handleSubmit} className="budget-form">

                    <div>
                        <label htmlFor="budget-category">Category</label>

                        <select
                            id="budget-category"
                            name="category"
                            value={formData.category}
                            onChange={handleChange}
                        >
                            <option value="Food">Food</option>
                            <option value="Housing">Housing</option>
                            <option value="Transport">Transport</option>
                            <option value="Entertainment">Entertainment</option>
                            <option value="Utilities">Utilities</option>
                            <option value="Other">Other</option>
                        </select>
                    </div>

                    <div>
                        <label htmlFor="budget-amount">Monthly Limit ($)</label>

                        <input
                            id="budget-amount"
                            type="number"
                            name="budget_amount"
                            min="0.01"
                            step="0.01"
                            placeholder="500.00"
                            value={formData.budget_amount}
                            onChange={handleChange}
                            required
                        />
                    </div>

                    <button type="submit" disabled={saving}>
                        {saving ? "Saving..." : "Create Budget"}
                    </button>

                </form>
            </section>

            <section className="budget-list-panel">

                <h2>Category Budgets</h2>

                {loading ? (
                    <p>Loading budgets...</p>
                ) : budgets.length === 0 ? (
                    <p>No budgets configured for this month.</p>
                ) : (
                    <div className="budget-list">

                        {budgets.map(budget => {
                            const percentage = budget.percentage_used;
                            const progressWidth = Math.min(
                                Math.max(percentage, 0),
                                100
                            );

                            return (
                                <article
                                    className="budget-item"
                                    key={budget.budget_id}
                                >
                                    <div className="budget-item-header">
                                        <h3>{budget.category}</h3>

                                        <span>
                                            {formatCurrency(budget.spent)}
                                            {" / "}
                                            {formatCurrency(budget.budget_amount)}
                                        </span>
                                    </div>

                                    <div
                                        className="budget-progress"
                                        role="progressbar"
                                        aria-label={`${budget.category} budget used`}
                                        aria-valuenow={progressWidth}
                                        aria-valuemin="0"
                                        aria-valuemax="100"
                                    >
                                        <div
                                            className={`budget-progress-fill ${
                                                percentage > 100
                                                    ? "over-budget"
                                                    : ""
                                            }`}
                                            style={{
                                                width: `${progressWidth}%`
                                            }}
                                        />
                                    </div>

                                    <div className="budget-item-footer">
                                        <span>{percentage}% used</span>

                                        <span>
                                            {budget.remaining >= 0
                                                ? `${formatCurrency(budget.remaining)} remaining`
                                                : `${formatCurrency(Math.abs(budget.remaining))} over budget`
                                            }
                                        </span>
                                    </div>
                                </article>
                            );
                        })}

                    </div>
                )}

            </section>

        </div>
    );
}

export default Budgets;