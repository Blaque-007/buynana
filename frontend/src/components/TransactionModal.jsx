import { useEffect, useState } from "react";

import { addTransaction } from "../services/transactionService";

import "./TransactionModal.css";

const categories = [
    "Food",
    "Housing",
    "Transport",
    "Entertainment",
    "Utilities",
    "Health",
    "Subscriptions",
    "Savings",
    "Other"
];

function TransactionModal({ isOpen, onClose, onTransactionAdded }) {

    const [formData, setFormData] = useState({
        description: "",
        amount: "",
        type: "expense",
        category: "Food"
    });

    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    // Close the modal using the Escape key
    useEffect(() => {
        if (!isOpen) return;

        function handleKeyDown(event) {
            if (event.key === "Escape" && !saving) {
                onClose();
            }
        }

        window.addEventListener("keydown", handleKeyDown);

        return () => {
            window.removeEventListener("keydown", handleKeyDown);
        };

    }, [isOpen, saving, onClose]);

    // Don't render the modal when it's closed
    if (!isOpen) return null;

    function handleChange(event) {
        const { name, value } = event.target;

        setFormData(previous => ({
            ...previous,
            [name]: value
        }));
    }

    async function handleSubmit(event) {
        event.preventDefault();

        if (saving) return;

        setError("");

        const amount = Number(formData.amount);

        if (!formData.description.trim()) {
            setError("Please enter a transaction description.");
            return;
        }

        if (!Number.isFinite(amount) || amount <= 0) {
            setError("Please enter an amount greater than zero.");
            return;
        }

        setSaving(true);

        try {
            await addTransaction({
                description: formData.description.trim(),
                amount,
                type: formData.type,
                category: formData.category
            });

            // Reset the form
            setFormData({
                description: "",
                amount: "",
                type: "expense",
                category: "Food"
            });

            // Notify the parent page
            if (onTransactionAdded) {
                await onTransactionAdded();
            }

            onClose();

        } catch (err) {
            setError(err.message);

        } finally {
            setSaving(false);
        }
    }

    return (
        <div
            className="transaction-modal-overlay"
            onMouseDown={event => {
                if (event.target === event.currentTarget && !saving) {
                    onClose();
                }
            }}
        >

            <div
                className="transaction-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="transaction-modal-title"
            >

                <div className="transaction-modal-header">

                    <div>
                        <h2 id="transaction-modal-title">
                            Add Transaction
                        </h2>

                        <p>Record your income or expenses</p>
                    </div>

                    <button
                        type="button"
                        className="transaction-modal-close"
                        onClick={onClose}
                        disabled={saving}
                        aria-label="Close transaction form"
                    >
                        ×
                    </button>

                </div>

                <form onSubmit={handleSubmit}>

                    <div className="transaction-modal-type">

                        <button
                            type="button"
                            className={
                                formData.type === "expense"
                                    ? "selected"
                                    : ""
                            }
                            onClick={() => {
                                setFormData(previous => ({
                                    ...previous,
                                    type: "expense"
                                }));
                            }}
                        >
                            Expense
                        </button>

                        <button
                            type="button"
                            className={
                                formData.type === "income"
                                    ? "selected"
                                    : ""
                            }
                            onClick={() => {
                                setFormData(previous => ({
                                    ...previous,
                                    type: "income"
                                }));
                            }}
                        >
                            Income
                        </button>

                    </div>

                    <div className="transaction-modal-field">

                        <label htmlFor="transaction-description">
                            Description
                        </label>

                        <input
                            id="transaction-description"
                            name="description"
                            type="text"
                            placeholder="e.g. Grocery shopping"
                            value={formData.description}
                            onChange={handleChange}
                            required
                            autoFocus
                        />

                    </div>

                    <div className="transaction-modal-field">

                        <label htmlFor="transaction-amount">
                            Amount ($)
                        </label>

                        <input
                            id="transaction-amount"
                            name="amount"
                            type="number"
                            min="0.01"
                            step="0.01"
                            placeholder="0.00"
                            value={formData.amount}
                            onChange={handleChange}
                            required
                        />

                    </div>

                    <div className="transaction-modal-field">

                        <label htmlFor="transaction-category">
                            Category
                        </label>

                        <select
                            id="transaction-category"
                            name="category"
                            value={formData.category}
                            onChange={handleChange}
                        >
                            {categories.map(category => (
                                <option
                                    key={category}
                                    value={category}
                                >
                                    {category}
                                </option>
                            ))}
                        </select>

                    </div>

                    {error && (
                        <p className="transaction-modal-error" role="alert">
                            {error}
                        </p>
                    )}

                    <div className="transaction-modal-actions">

                        <button
                            type="button"
                            className="transaction-modal-cancel"
                            onClick={onClose}
                            disabled={saving}
                        >
                            Cancel
                        </button>

                        <button
                            type="submit"
                            className="transaction-modal-submit"
                            disabled={saving}
                        >
                            {saving ? "Saving..." : "Save Transaction"}
                        </button>

                    </div>

                </form>

            </div>

        </div>
    );
}

export default TransactionModal;