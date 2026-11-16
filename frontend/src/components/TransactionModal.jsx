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

// Get today's date in YYYY-MM-DD format
function getTodayDate() {
    const today = new Date();

    return [
        today.getFullYear(),
        String(today.getMonth() + 1).padStart(2, "0"),
        String(today.getDate()).padStart(2, "0")
    ].join("-");
}

// Default form values
function createInitialForm() {
    return {
        description: "",
        amount: "",
        type: "expense",
        category: "Food",
        transaction_date: getTodayDate(),
        is_recurring: false,
        recurring_frequency: "monthly"
    };
}

function TransactionModal({
    isOpen,
    onClose,
    onTransactionAdded
}) {
    const [formData, setFormData] = useState(createInitialForm);

    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    // Close using Escape
    useEffect(() => {
        if (!isOpen) return;

        function handleKeyDown(event) {
            if (event.key === "Escape" && !saving) {
                handleClose();
            }
        }

        window.addEventListener("keydown", handleKeyDown);

        return () => {
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [isOpen, saving]);

    // Reset form and close modal
    function handleClose() {
        if (saving) return;

        setFormData(createInitialForm());
        setError("");
        onClose();
    }

    // Handle text, number, date, and select inputs
    function handleChange(event) {
        const { name, value } = event.target;

        setFormData(previous => ({
            ...previous,
            [name]: value
        }));
    }

    // Handle recurring checkbox
    function handleRecurringChange(event) {
        const checked = event.target.checked;

        setFormData(previous => ({
            ...previous,
            is_recurring: checked
        }));
    }

    // Save transaction
    async function handleSubmit(event) {
        event.preventDefault();

        if (saving) return;

        setError("");

        const amount = Number(formData.amount);

        if (!formData.description.trim()) {
            setError("Please enter a description.");
            return;
        }

        if (!Number.isFinite(amount) || amount <= 0) {
            setError("Amount must be greater than zero.");
            return;
        }

        setSaving(true);

        try {
            const transaction = {
                description: formData.description.trim(),
                amount,
                type: formData.type,
                category: formData.category,
                transaction_date: formData.transaction_date,

                // SQLite uses 1 and 0 for Boolean values
                is_recurring: formData.is_recurring ? 1 : 0,

                recurring_frequency: formData.is_recurring
                    ? formData.recurring_frequency
                    : null
            };

            await addTransaction(transaction);

            // Reset form after saving
            setFormData(createInitialForm());

            // Refresh parent page
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

    if (!isOpen) return null;

    return (
        <div
            className="transaction-modal-overlay"
            onMouseDown={event => {
                if (
                    event.target === event.currentTarget &&
                    !saving
                ) {
                    handleClose();
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
                        onClick={handleClose}
                        disabled={saving}
                        aria-label="Close transaction form"
                    >
                        ×
                    </button>
                </div>

                <form onSubmit={handleSubmit}>

                    {/* Transaction type */}

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

                    {/* Description */}

                    <div className="transaction-modal-field">
                        <label htmlFor="transaction-description">
                            Description
                        </label>

                        <input
                            id="transaction-description"
                            name="description"
                            type="text"
                            placeholder="e.g. Netflix subscription"
                            value={formData.description}
                            onChange={handleChange}
                            required
                            autoFocus
                        />
                    </div>

                    {/* Amount */}

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

                    {/* Category */}

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
                                <option key={category} value={category}>
                                    {category}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Transaction date */}

                    <div className="transaction-modal-field">
                        <label htmlFor="transaction-date">
                            Transaction Date
                        </label>

                        <input
                            id="transaction-date"
                            name="transaction_date"
                            type="date"
                            value={formData.transaction_date}
                            onChange={handleChange}
                            required
                        />
                    </div>

                    {/* Recurring checkbox */}

                    <div className="transaction-modal-recurring">
                        <label htmlFor="transaction-recurring">
                            <input
                                id="transaction-recurring"
                                type="checkbox"
                                checked={formData.is_recurring}
                                onChange={handleRecurringChange}
                            />

                            <span>
                                This is a recurring transaction
                            </span>
                        </label>

                        <p>
                            Mark transactions that repeat regularly,
                            such as rent or subscriptions.
                        </p>
                    </div>

                    {/* Frequency appears only when recurring */}

                    {formData.is_recurring && (
                        <div className="transaction-modal-field">
                            <label htmlFor="transaction-frequency">
                                Recurring Frequency
                            </label>

                            <select
                                id="transaction-frequency"
                                name="recurring_frequency"
                                value={formData.recurring_frequency}
                                onChange={handleChange}
                            >
                                <option value="weekly">
                                    Weekly
                                </option>

                                <option value="monthly">
                                    Monthly
                                </option>

                                <option value="yearly">
                                    Yearly
                                </option>
                            </select>
                        </div>
                    )}

                    {error && (
                        <p
                            className="transaction-modal-error"
                            role="alert"
                        >
                            {error}
                        </p>
                    )}

                    {/* Form buttons */}

                    <div className="transaction-modal-actions">
                        <button
                            type="button"
                            className="transaction-modal-cancel"
                            onClick={handleClose}
                            disabled={saving}
                        >
                            Cancel
                        </button>

                        <button
                            type="submit"
                            className="transaction-modal-submit"
                            disabled={saving}
                        >
                            {saving
                                ? "Saving..."
                                : "Save Transaction"}
                        </button>
                    </div>

                </form>
            </div>
        </div>
    );
}

export default TransactionModal;