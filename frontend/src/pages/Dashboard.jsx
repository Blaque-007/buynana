import { useEffect, useState } from "react";
import BudgetOverview from "../components/BudgetOverview";
import { getBudgets } from "../services/budgetService";
import TransactionModal from "../components/TransactionModal";
import SummaryCard from "../components/SummaryCard";
import { getTransactions } from "../services/transactionService";

import "./Dashboard.css";

function Dashboard() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [budgets, setBudgets] = useState([]);
  const [budgetsLoading, setBudgetsLoading] = useState(true);
  const [budgetsError, setBudgetsError] = useState("");
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);

  async function refreshDashboard() {
    const now = new Date();

    const month = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, "0"),
    ].join("-");

    const [updatedTransactions, updatedBudgets] = await Promise.all([
      getTransactions(),
      getBudgets(month),
    ]);

    setTransactions(updatedTransactions);
    setBudgets(updatedBudgets);
  }

  // Retrieve transactions from Express
  useEffect(() => {
    async function loadDashboard() {
      try {
        const data = await getTransactions();

        setTransactions(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadBudgets() {
      setBudgetsLoading(true);

      try {
        const now = new Date();

        const month = [
          now.getFullYear(),
          String(now.getMonth() + 1).padStart(2, "0"),
        ].join("-");

        const data = await getBudgets(month);

        if (!cancelled) {
          setBudgets(data);
          setBudgetsError("");
        }
      } catch (err) {
        if (!cancelled) {
          setBudgetsError(err.message);
        }
      } finally {
        if (!cancelled) {
          setBudgetsLoading(false);
        }
      }
    }

    loadBudgets();

    return () => {
      cancelled = true;
    };
  }, []);

  // Calculate financial totals
  const income = transactions
    .filter((transaction) => transaction.type === "income")
    .reduce((total, transaction) => total + transaction.amount, 0);

  const expenses = transactions
    .filter((transaction) => transaction.type === "expense")
    .reduce((total, transaction) => total + transaction.amount, 0);

  const balance = income - expenses;

  // Format amounts as US dollars
  const formatCurrency = (amount) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);

  // Display the five most recent transactions
  const recentTransactions = transactions.slice(0, 5);

  return (
    <div className="dashboard-page">
      <div className="dashboard-topbar">
        <h1>Dashboard</h1>
        <TransactionModal
          isOpen={isTransactionModalOpen}
          onClose={() => setIsTransactionModalOpen(false)}
          onTransactionAdded={refreshDashboard}
        />
      </div>

      <div className="dashboard-heading">
        <h2>Welcome back, Jane</h2>

        <div className="dashboard-heading-actions">
          <span>
            {new Date().toLocaleDateString("en-US", {
              month: "short",
              year: "numeric",
            })}
          </span>

          <button
            type="button"
            className="dashboard-add-button"
            onClick={() => setIsTransactionModalOpen(true)}
          >
            + Add Transaction
          </button>
        </div>
      </div>

      {error && (
        <p className="dashboard-error">Unable to load dashboard: {error}</p>
      )}

      {loading ? (
        <p>Loading dashboard...</p>
      ) : (
        <>
          <section className="dashboard-summary">
            <SummaryCard
              title="Available Balance"
              value={formatCurrency(balance)}
              variant="balance"
            />

            <SummaryCard
              title="Income"
              value={formatCurrency(income)}
              variant="income"
            />

            <SummaryCard
              title="Recurring"
              value="Not configured"
              variant="recurring"
            />

            <SummaryCard
              title="Savings %"
              value="Not configured"
              variant="savings"
            />
          </section>

          <section className="dashboard-content">
            <div className="dashboard-panel">
              <div className="dashboard-panel__header">
                <h3>Budget Overview</h3>
              </div>

              <div className="dashboard-panel__body">
                <BudgetOverview
                  budgets={budgets}
                  loading={budgetsLoading}
                  error={budgetsError}
                />
              </div>
            </div>

            <div className="dashboard-panel">
              <div className="dashboard-panel__header">
                <h3>Recent Transactions</h3>
              </div>

              <div className="dashboard-panel__body">
                {recentTransactions.length === 0 ? (
                  <p>No transactions recorded yet.</p>
                ) : (
                  <div className="recent-transactions">
                    {recentTransactions.map((transaction) => (
                      <div
                        className="recent-transaction"
                        key={transaction.transaction_id}
                      >
                        <div>
                          <strong>{transaction.description}</strong>

                          <span>{transaction.category}</span>
                        </div>

                        <strong
                          className={
                            transaction.type === "income"
                              ? "amount-income"
                              : "amount-expense"
                          }
                        >
                          {transaction.type === "income" ? "+" : "-"}
                          {formatCurrency(transaction.amount)}
                        </strong>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

export default Dashboard;
