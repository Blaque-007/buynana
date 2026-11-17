import { useEffect, useState } from "react";
import { getSavingsGoals } from "../services/savingsService";
import SavingsGoalForm from "./SavingsGoalForm";
import "./SavingsGoals.css";
import SavingsContributionForm from "./SavingsContributionForm";

import { deleteSavingsGoal } from "../services/savingsService";

function SavingsGoals() {
  const [contributingGoal, setContributingGoal] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [editingGoal, setEditingGoal] = useState(null);

  async function loadGoals() {
    const data = await getSavingsGoals();
    setGoals(data);
  }

  useEffect(() => {
    async function initialize() {
      try {
        await loadGoals();
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    initialize();
  }, []);

  const formatCurrency = (amount) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);

  function handleCreate() {
    setEditingGoal(null);
    setShowForm(true);
  }

  function handleEdit(goal) {
    setEditingGoal(goal);
    setShowForm(true);
  }

  function handleCancel() {
    setEditingGoal(null);
    setShowForm(false);
  }

  async function handleSaved() {
    await loadGoals();
    window.dispatchEvent(new Event("buynana:savings-changed"));
    setError("");
    handleCancel();
  }

  function handleContribute(goal) {
    setShowForm(false);
    setEditingGoal(null);
    setContributingGoal(goal);
  }

  function handleCancelContribution() {
    setContributingGoal(null);
  }

  async function handleContributionSaved() {
    await loadGoals();
    window.dispatchEvent(new Event("buynana:savings-changed"));
    setError("");
    setContributingGoal(null);
  }

  async function handleDelete(goal) {
    const confirmed = window.confirm(
      `Delete "${goal.goal_name}"?\n\n` +
        "The goal will disappear from your active goals, " +
        "but its savings contributions will remain recorded " +
        "and will not be returned to your available balance.",
    );

    if (!confirmed) return;

    setDeleting(true);
    setError("");

    try {
      await deleteSavingsGoal(goal.goal_id);
      await loadGoals();
      window.dispatchEvent(new Event("buynana:savings-changed"));

      setEditingGoal(null);
      setShowForm(false);
      setContributingGoal(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return <p>Loading savings goals...</p>;
  }

  return (
    <section className="savings-goals">
      <div className="savings-goals-header">
        <div>
          <h2>Savings Goals</h2>
          <p>Track your progress toward financial goals.</p>
        </div>

        <button
          type="button"
          className="savings-primary-button"
          onClick={handleCreate}
        >
          + New Goal
        </button>
      </div>

      {error && (
        <p className="savings-error" role="alert">
          Unable to load savings goals: {error}
        </p>
      )}

      {showForm && (
        <SavingsGoalForm
          key={editingGoal?.goal_id ?? "new"}
          goal={editingGoal}
          onSaved={handleSaved}
          onCancel={handleCancel}
          onDelete={handleDelete}
          deleting={deleting}
        />
      )}

      {contributingGoal && (
        <SavingsContributionForm
          key={contributingGoal.goal_id}
          goal={contributingGoal}
          onSaved={handleContributionSaved}
          onCancel={handleCancelContribution}
        />
      )}

      {goals.length === 0 ? (
        <div className="savings-empty">
          <p>No savings goals created yet.</p>
        </div>
      ) : (
        <div className="savings-goals-list">
          {goals.map((goal) => {
            const progress = Math.min(
              100,
              Math.max(0, goal.progress_percentage),
            );

            return (
              <div className="savings-goal-card" key={goal.goal_id}>
                <div className="savings-goal-heading">
                  <h3>{goal.goal_name}</h3>

                  <span>{progress.toFixed(1)}%</span>
                </div>

                <div
                  className="savings-progress-track"
                  role="progressbar"
                  aria-label={`${goal.goal_name} progress`}
                  aria-valuenow={progress}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div
                    className="savings-progress-fill"
                    style={{ width: `${progress}%` }}
                  />
                </div>

                <div className="savings-goal-amounts">
                  <span>{formatCurrency(goal.saved_amount)} saved</span>

                  <span>{formatCurrency(goal.target_amount)} target</span>
                </div>

                {goal.monthly_allocation > 0 && (
                  <p className="savings-goal-remaining">Planned: {formatCurrency(goal.monthly_allocation)}/month</p>
                )}
                <p className="savings-goal-remaining">
                  {formatCurrency(goal.remaining_amount)} remaining
                </p>

                <div className="savings-goal-actions">
                  <button
                    type="button"
                    className="savings-primary-button"
                    onClick={() => handleContribute(goal)}
                    disabled={goal.remaining_amount <= 0}
                  >
                    {goal.remaining_amount <= 0
                      ? "Goal Complete"
                      : "+ Add Savings"}
                  </button>

                  <button
                    type="button"
                    className="savings-edit-button"
                    onClick={() => {
                      setContributingGoal(null);
                      handleEdit(goal);
                    }}
                  >
                    Edit Goal
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default SavingsGoals;
