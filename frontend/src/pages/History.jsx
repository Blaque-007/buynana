import { useEffect, useState } from "react";
import TransactionModal from "../components/TransactionModal";
import {
  getTransactions,
  deleteTransaction,
} from "../services/transactionService";

import "./History.css";

function History() {
  const [transactions, setTransactions] = useState([]);
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [monthFilter, setMonthFilter] = useState("");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState(null);

  async function refreshHistory() {
    const updatedTransactions = await getTransactions();

    setTransactions(updatedTransactions);
  }

  // Retrieve transactions when the page loads
  useEffect(() => {
    async function loadTransactions() {
      try {
        const data = await getTransactions();

        setTransactions(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadTransactions();
  }, []);

  // Format money
  function formatCurrency(amount) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  }

  // Format transaction dates without timezone shifting
  function formatDate(date) {
    if (!date) return "—";

    const [year, month, day] = date.slice(0, 10).split("-");

    return `${month}/${day}/${year}`;
  }

  // Get unique categories from transactions
  const categories = [
    ...new Set(transactions.map((transaction) => transaction.category)),
  ].sort();

  // Apply search and filters
  const filteredTransactions = transactions.filter((transaction) => {
    const searchText = search.toLowerCase().trim();

    const matchesSearch =
      transaction.description.toLowerCase().includes(searchText) ||
      transaction.category.toLowerCase().includes(searchText);

    const matchesType = typeFilter === "all" || transaction.type === typeFilter;

    const matchesCategory =
      categoryFilter === "all" || transaction.category === categoryFilter;

    const matchesMonth =
      !monthFilter || transaction.transaction_date.slice(0, 7) === monthFilter;

    return matchesSearch && matchesType && matchesCategory && matchesMonth;
  });

  // Calculate totals for the currently displayed transactions
  const filteredIncome = filteredTransactions
    .filter((transaction) => transaction.type === "income")
    .reduce((total, transaction) => total + transaction.amount, 0);

  const filteredExpenses = filteredTransactions
    .filter((transaction) => transaction.type === "expense")
    .reduce((total, transaction) => total + transaction.amount, 0);

  const filteredNet = filteredIncome - filteredExpenses;

  // Delete a transaction
  async function handleDelete(transaction) {
    const confirmed = window.confirm(
      `Delete "${transaction.description}" (${formatCurrency(transaction.amount)})?`,
    );

    if (!confirmed) return;

    setDeletingId(transaction.transaction_id);
    setError("");

    try {
      await deleteTransaction(transaction.transaction_id);

      // Remove the deleted transaction from React state
      setTransactions((previous) =>
        previous.filter(
          (item) => item.transaction_id !== transaction.transaction_id,
        ),
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="history-page">
      <TransactionModal
        isOpen={isTransactionModalOpen}
        onClose={() => setIsTransactionModalOpen(false)}
        onTransactionAdded={refreshHistory}
      />
      <header className="history-header">
        <div>
          <h1>Transaction History</h1>
          <p>View and manage your financial activity</p>
        </div>

        <div className="history-header-actions">
          <span className="history-count">
            {filteredTransactions.length} transactions
          </span>

          <button
            type="button"
            className="history-add-button"
            onClick={() => setIsTransactionModalOpen(true)}
          >
            + Add Transaction
          </button>
        </div>
      </header>

      {error && (
        <p className="history-error" role="alert">
          {error}
        </p>
      )}

      {/* Search and filter controls */}

      <section className="history-filters">
        <div className="history-filter-field history-search">
          <label htmlFor="history-search">Search</label>

          <input
            id="history-search"
            type="search"
            placeholder="Search transactions..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        <div className="history-filter-field">
          <label htmlFor="history-type">Type</label>

          <select
            id="history-type"
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value)}
          >
            <option value="all">All Types</option>
            <option value="income">Income</option>
            <option value="expense">Expense</option>
          </select>
        </div>

        <div className="history-filter-field">
          <label htmlFor="history-category">Category</label>

          <select
            id="history-category"
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
          >
            <option value="all">All Categories</option>

            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </div>

        <div className="history-filter-field">
          <label htmlFor="history-month">Month</label>

          <input
            id="history-month"
            type="month"
            value={monthFilter}
            onChange={(event) => setMonthFilter(event.target.value)}
          />
        </div>

        <button
          type="button"
          className="history-clear-button"
          onClick={() => {
            setSearch("");
            setTypeFilter("all");
            setCategoryFilter("all");
            setMonthFilter("");
          }}
        >
          Clear Filters
        </button>
      </section>

      {/* Financial summary */}

      <section className="history-summary">
        <div className="history-summary-card">
          <span>Filtered Income</span>
          <strong>{formatCurrency(filteredIncome)}</strong>
        </div>

        <div className="history-summary-card">
          <span>Filtered Expenses</span>
          <strong>{formatCurrency(filteredExpenses)}</strong>
        </div>

        <div className="history-summary-card">
          <span>Filtered Net</span>
          <strong>{formatCurrency(filteredNet)}</strong>
        </div>
      </section>

      {/* Transaction table */}

      <section className="history-table-panel">
        <div className="history-table-header">
          <h2>Transactions</h2>
        </div>

        {loading ? (
          <p className="history-message">Loading transactions...</p>
        ) : filteredTransactions.length === 0 ? (
          <p className="history-message">No transactions match your filters.</p>
        ) : (
          <div className="history-table-scroll">
            <table className="history-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Category</th>
                  <th>Type</th>
                  <th>Recurring</th>
                  <th>Amount</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {filteredTransactions.map((transaction) => (
                  <tr key={transaction.transaction_id}>
                    <td>{formatDate(transaction.transaction_date)}</td>

                    <td className="history-description">
                      {transaction.description}
                    </td>

                    <td>{transaction.category}</td>

                    <td>
                      <span
                        className={`history-type-badge ${transaction.type}`}
                      >
                        {transaction.type}
                      </span>
                    </td>

                    <td>
                      {transaction.is_recurring === 1 ? (
                        <span className="history-recurring-badge">
                          ↻ {transaction.recurring_frequency}
                        </span>
                      ) : (
                        <span className="history-not-recurring">—</span>
                      )}
                    </td>

                    <td
                      className={
                        transaction.type === "income"
                          ? "history-income"
                          : "history-expense"
                      }
                    >
                      {transaction.type === "income" ? "+" : "-"}
                      {formatCurrency(transaction.amount)}
                    </td>

                    <td>
                      <button
                        type="button"
                        className="history-delete-button"
                        disabled={deletingId === transaction.transaction_id}
                        onClick={() => handleDelete(transaction)}
                      >
                        {deletingId === transaction.transaction_id
                          ? "Deleting..."
                          : "Delete"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

export default History;
