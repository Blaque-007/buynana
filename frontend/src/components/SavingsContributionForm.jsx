import { useState } from "react";
import { addSavingsContribution } from "../services/savingsService";

function SavingsContributionForm({ goal, onSaved, onCancel }) {
    const [amount, setAmount] = useState("");
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    const remaining = Math.max(
        0,
        goal.target_amount - goal.saved_amount
    );

    async function handleSubmit(event) {
        event.preventDefault();

        const contribution = Number(amount);

        if (
            !Number.isFinite(contribution) ||
            contribution <= 0 ||
            contribution > remaining
        ) {
            setError(
                "Enter a positive amount that does not exceed the remaining goal."
            );
            return;
        }

        setSaving(true);
        setError("");

        try {
            await addSavingsContribution(goal.goal_id, contribution);
            await onSaved();
        } catch (err) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    }

    return (
        <form className="savings-goal-form" onSubmit={handleSubmit}>
            <h3>Add Savings — {goal.goal_name}</h3>

            <p>
                Remaining target: ${remaining.toFixed(2)}
            </p>

            <div className="savings-goal-field">
                <label htmlFor="contribution-amount">
                    Contribution Amount ($)
                </label>

                <input
                    id="contribution-amount"
                    type="number"
                    min="0.01"
                    max={remaining}
                    step="0.01"
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                    placeholder="Enter amount"
                    required
                />
            </div>

            {error && (
                <p className="savings-error" role="alert">
                    {error}
                </p>
            )}

            <div className="savings-goal-form-actions">
                <button
                    type="button"
                    className="savings-secondary-button"
                    onClick={onCancel}
                    disabled={saving}
                >
                    Cancel
                </button>

                <button
                    type="submit"
                    className="savings-primary-button"
                    disabled={saving}
                >
                    {saving ? "Saving..." : "Add Savings"}
                </button>
            </div>
        </form>
    );
}

export default SavingsContributionForm;