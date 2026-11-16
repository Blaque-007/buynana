import { useEffect, useState } from "react";
import {
  createSavingsGoal,
  updateSavingsGoal,
} from "../services/savingsService";

function SavingsGoalForm({
  goal,
  onSaved,
  onCancel,
  onDelete,
  deleting = false,
}) {
  const isEditing = Boolean(goal);

  const [name, setName] = useState(goal?.goal_name ?? "");
  const [target, setTarget] = useState(goal?.target_amount?.toString() ?? "");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setName(goal?.goal_name ?? "");
    setTarget(goal?.target_amount?.toString() ?? "");
    setError("");
  }, [goal]);

  async function handleSubmit(event) {
    event.preventDefault();

    if (saving) return;

    const targetAmount = Number(target);

    if (!name.trim()) {
      setError("Please enter a goal name.");
      return;
    }

    if (!Number.isFinite(targetAmount) || targetAmount <= 0) {
      setError("Target amount must be greater than zero.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const goalData = {
        goal_name: name.trim(),
        target_amount: targetAmount,
      };

      if (isEditing) {
        await updateSavingsGoal(goal.goal_id, goalData);
      } else {
        await createSavingsGoal(goalData);
      }

      await onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="savings-goal-form" onSubmit={handleSubmit}>
      <h3>{isEditing ? "Edit Savings Goal" : "Create Savings Goal"}</h3>

      <div className="savings-goal-field">
        <label htmlFor="savings-goal-name">Goal Name</label>

        <input
          id="savings-goal-name"
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="e.g. Vacation Fund"
          maxLength={100}
          required
        />
      </div>

      <div className="savings-goal-field">
        <label htmlFor="savings-goal-target">Target Amount ($)</label>

        <input
          id="savings-goal-target"
          type="number"
          min="0.01"
          step="0.01"
          value={target}
          onChange={(event) => setTarget(event.target.value)}
          placeholder="e.g. 2500"
          required
        />
      </div>

      {error && (
        <p className="savings-error" role="alert">
          {error}
        </p>
      )}

      <div className="savings-goal-form-actions">
        {isEditing && (
          <button
            type="button"
            className="savings-delete-button"
            onClick={() => onDelete(goal)}
            disabled={saving || deleting}
          >
            {deleting ? "Deleting..." : "Delete Goal"}
          </button>
        )}
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
          {saving ? "Saving..." : isEditing ? "Save Changes" : "Create Goal"}
        </button>
      </div>
    </form>
  );
}

export default SavingsGoalForm;
