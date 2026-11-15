import { useEffect, useState } from "react";

import {
    getTransactions,
    addTransaction
} from "../services/transactionService";

import "../App.css";

function TransactionTest() {

    // Store transactions retrieved from SQLite
    const [transactions, setTransactions] = useState([]);

    // Store information entered into the form
    const [formData, setFormData] = useState({
        description: "",
        amount: "",
        type: "expense",
        category: "Food"
    });

    // Track loading and error messages
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [saving, setSaving] = useState(false);

    // Retrieve transactions from the backend
    async function loadTransactions() {
        try {
            setError("");

            const data = await getTransactions();

            setTransactions(data);

        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    // Load saved transactions when the page opens
    useEffect(() => {
        loadTransactions();
    }, []);

    // Update form values when the user types
    function handleChange(event) {
        const { name, value } = event.target;

        setFormData(previous => ({
            ...previous,
            [name]: value
        }));
    }

    // Submit the transaction to Express
    async function handleSubmit(event) {
        event.preventDefault();

        if (saving) return;

        setError("");
        setSuccess("");

        const amount = Number(formData.amount);

        if (!Number.isFinite(amount) || amount <= 0) {
            setError("Please enter a valid amount greater than zero.");
            return;
        }

        setSaving(true);

        try {
            const transaction = {
                description: formData.description,
                amount: amount,
                type: formData.type,
                category: formData.category
            };

            // Save the transaction in SQLite
            await addTransaction(transaction);

            setSuccess("Transaction saved successfully!");

            // Clear the form
            setFormData(previous => ({
                ...previous,
                description: "",
                amount: ""
            }));

            // Retrieve updated records from the database
            await loadTransactions();

        } catch (err) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    }

    // Calculate total income and expenses
    const totalIncome = transactions
        .filter(transaction => transaction.type === "income")
        .reduce((total, transaction) => total + transaction.amount, 0);

    const totalExpenses = transactions
        .filter(transaction => transaction.type === "expense")
        .reduce((total, transaction) => total + transaction.amount, 0);

    const balance = totalIncome - totalExpenses;

    // Format amounts as US dollars
    function formatCurrency(amount) {
        return new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD"
        }).format(amount);
    }

    return (
        <div className="app-container">

            <header>
                <h1>🍌 BuyNana</h1>
                <p>Financial Tracker — Development Prototype</p>
            </header>

            <section className="summary">

                <div className="summary-card">
                    <h3>Total Income</h3>
                    <p>{formatCurrency(totalIncome)}</p>
                </div>

                <div className="summary-card">
                    <h3>Total Expenses</h3>
                    <p>{formatCurrency(totalExpenses)}</p>
                </div>

                <div className="summary-card">
                    <h3>Available Balance</h3>
                    <p>{formatCurrency(balance)}</p>
                </div>

            </section>

            <section className="transaction-form">

                <h2>Add Transaction</h2>

                <form onSubmit={handleSubmit}>

                    <label htmlFor="description">Description</label>

                    <input
                        id="description"
                        type="text"
                        name="description"
                        placeholder="e.g. Groceries"
                        value={formData.description}
                        onChange={handleChange}
                        required
                    />

                    <label htmlFor="amount">Amount ($)</label>

                    <input
                        id="amount"
                        type="number"
                        name="amount"
                        placeholder="75.50"
                        min="0.01"
                        step="0.01"
                        value={formData.amount}
                        onChange={handleChange}
                        required
                    />

                    <label htmlFor="type">Transaction Type</label>

                    <select
                        id="type"
                        name="type"
                        value={formData.type}
                        onChange={handleChange}
                    >
                        <option value="expense">Expense</option>
                        <option value="income">Income</option>
                    </select>

                    <label htmlFor="category">Category</label>

                    <select
                        id="category"
                        name="category"
                        value={formData.category}
                        onChange={handleChange}
                    >
                        <option value="Food">Food</option>
                        <option value="Housing">Housing</option>
                        <option value="Transport">Transport</option>
                        <option value="Entertainment">Entertainment</option>
                        <option value="Utilities">Utilities</option>
                        <option value="Salary">Salary</option>
                        <option value="Other">Other</option>
                    </select>

                    <button type="submit" disabled={saving}>
                        {saving ? "Saving..." : "Add Transaction"}
                    </button>

                </form>

                {success && (
                    <p className="success-message">{success}</p>
                )}

                {error && (
                    <p className="error-message">{error}</p>
                )}

            </section>

            <section className="transaction-history">

                <h2>Transaction History</h2>

                {loading ? (
                    <p>Loading transactions...</p>
                ) : transactions.length === 0 ? (
                    <p>No transactions recorded yet.</p>
                ) : (
                    <table>

                        <thead>
                            <tr>
                                <th>Description</th>
                                <th>Category</th>
                                <th>Type</th>
                                <th>Amount</th>
                                <th>Date</th>
                            </tr>
                        </thead>

                        <tbody>
                            {transactions.map(transaction => (
                                <tr key={transaction.transaction_id}>

                                    <td>{transaction.description}</td>

                                    <td>{transaction.category}</td>

                                    <td>{transaction.type}</td>

                                    <td>
                                        {formatCurrency(transaction.amount)}
                                    </td>

                                    <td>{transaction.transaction_date}</td>

                                </tr>
                            ))}
                        </tbody>

                    </table>
                )}

            </section>

        </div>
    );
}

export default TransactionTest;