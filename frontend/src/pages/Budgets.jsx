import { useEffect, useState } from "react";
import MonthPicker from "../components/MonthPicker";
import ConfirmDialog from "../components/ConfirmDialog";
import {monthLabel,money} from "../utils/format";
import { getBudgets, addBudget, updateBudget, deleteBudget } from "../services/budgetService";

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
    const [editingBudget,setEditingBudget]=useState(null);
    const [editingAmount,setEditingAmount]=useState("");
    const [deletingBudget,setDeletingBudget]=useState(null);

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

    // Keep budget progress current when a transaction is added from the sidebar.
    useEffect(() => {
        const reload = async () => {try{setBudgets(await getBudgets(month));}catch(e){setError(e.message);}};
        window.addEventListener('buynana:transactions-changed', reload);
        return () => window.removeEventListener('buynana:transactions-changed', reload);
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

    async function handleEditBudget(event) {
        event.preventDefault();
        if(!editingBudget)return;
        const amount=Number(editingAmount);
        if(!Number.isFinite(amount)||amount<=0){setError('Enter a valid positive budget amount.');return;}
        setSaving(true);
        try{await updateBudget(editingBudget.budget_id,{category:editingBudget.category,budget_amount:amount,budget_month:editingBudget.budget_month});
            setBudgets(await getBudgets(month));setEditingBudget(null);setError('');setSuccess('Budget updated.');}
        catch(e){setError(e.message);}finally{setSaving(false);}
    }
    async function handleDeleteBudget(){
        if(!deletingBudget)return;
        setSaving(true);
        try{await deleteBudget(deletingBudget.budget_id);setBudgets(await getBudgets(month));setDeletingBudget(null);setError('');setSuccess('Budget deleted.');}
        catch(e){setError(e.message);setDeletingBudget(null);}finally{setSaving(false);}
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

            <header className="page-header">
                <div>
                    <h1>Budgets</h1>
                    <p className="page-subtitle">Manage monthly spending limits and see how much remains.</p>
                </div>

                <div className="page-header-actions"><span className="muted">Month</span><MonthPicker id="budget" value={month} onChange={value=>{setMonth(value);setSuccess("");}}/></div>
            </header>

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
                            <option value="Subscriptions">Subscriptions</option>
                            <option value="Groceries">Groceries</option>
                            <option value="Rent">Rent</option>
                            <option value="Health">Health</option>
                            <option value="Misc">Misc</option>
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

                    <button type="submit" className="btn btn--primary" disabled={saving}>
                        {saving ? "Saving..." : "Create Budget"}
                    </button>

                </form>
            </section>

            <section className="budget-list-panel">

                <h2>Category Budgets</h2>

                {loading ? (
                    <p>Loading budgets...</p>
                ) : budgets.length === 0 ? (
                    <div className="empty-state"><h3>No budgets for {monthLabel(month)}</h3><p>Choose a category and set a monthly limit using the form above.</p></div>
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
                                    {editingBudget?.budget_id===budget.budget_id && <form className="budget-inline-edit" onSubmit={handleEditBudget}>
                                      <label htmlFor={`edit-budget-${budget.budget_id}`}>Updated monthly limit ($)</label>
                                      <input id={`edit-budget-${budget.budget_id}`} type="number" min="0.01" step="0.01" required value={editingAmount} onChange={e=>setEditingAmount(e.target.value)}/>
                                      <button className="btn btn--primary btn--small" type="submit" disabled={saving}>Save</button>
                                      <button className="btn btn--ghost btn--small" type="button" onClick={()=>setEditingBudget(null)}>Cancel</button>
                                    </form>}
                                    <div className="budget-item-actions">
                                      <button className="btn btn--secondary btn--small" type="button" onClick={() => {setEditingBudget(budget);setEditingAmount(String(budget.budget_amount));}}>Edit limit</button>
                                      <button className="btn btn--danger btn--small" type="button" onClick={() => setDeletingBudget(budget)}>Delete</button>
                                    </div>
                                </article>
                            );
                        })}

                    </div>
                )}

            </section>

        <ConfirmDialog open={Boolean(deletingBudget)} title="Delete budget?" onCancel={()=>setDeletingBudget(null)} onConfirm={handleDeleteBudget} busy={saving}>
          <p>Delete the {deletingBudget?.category} budget for {monthLabel(deletingBudget?.budget_month)}? Your transactions will remain recorded.</p>
        </ConfirmDialog>
        </div>
    );
}

export default Budgets;