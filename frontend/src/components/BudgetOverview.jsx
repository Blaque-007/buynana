import { Link } from "react-router-dom";

function BudgetOverview({ budgets, loading, error }) {

    const formatCurrency = amount =>
        new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD"
        }).format(amount);

    const totalBudget = budgets.reduce(
        (total, budget) => total + budget.budget_amount,
        0
    );

    const totalSpent = budgets.reduce(
        (total, budget) => total + budget.spent,
        0
    );

    const percentageUsed = totalBudget > 0
        ? Math.round((totalSpent / totalBudget) * 100)
        : 0;

    return (
        <div className="budget-overview">

            <div className="budget-overview__summary">

                <div>
                    <span className="budget-overview__label">
                        Monthly Budget
                    </span>

                    <h2>{formatCurrency(totalBudget)}</h2>
                </div>

                <div>
                    <span className="budget-overview__label">
                        Spent
                    </span>

                    <h2>{formatCurrency(totalSpent)}</h2>
                </div>

            </div>

            {loading ? (
                <p>Loading budgets...</p>
            ) : error ? (
                <p role="alert">{error}</p>
            ) : budgets.length === 0 ? (
                <div className="budget-overview__empty">
                    <p>No budgets configured for this month.</p>

                    <Link to="/budgets">
                        Create a Budget →
                    </Link>
                </div>
            ) : (
                <>
                    <div className="budget-overview__progress">

                        <div
                            className="budget-overview__progress-fill"
                            style={{
                                width: `${Math.min(
                                    Math.max(percentageUsed, 0),
                                    100
                                )}%`
                            }}
                        />

                    </div>

                    <div className="budget-overview__progress-label">
                        <span>{percentageUsed}% used</span>

                        <span>
                            {formatCurrency(totalBudget - totalSpent)} remaining
                        </span>
                    </div>

                    <div className="budget-overview__categories">

                        {budgets.slice(0, 4).map(budget => (

                            <div
                                className="budget-overview__category"
                                key={budget.budget_id}
                            >
                                <span>{budget.category}</span>

                                <span>
                                    {formatCurrency(budget.spent)}
                                    {" / "}
                                    {formatCurrency(budget.budget_amount)}
                                </span>
                            </div>

                        ))}

                    </div>

                    <Link
                        className="budget-overview__link"
                        to="/budgets"
                    >
                        View All Budgets →
                    </Link>
                </>
            )}

        </div>
    );
}

export default BudgetOverview;