const API_URL = "http://localhost:3001/api/transactions";

// Retrieve all transactions from SQLite through Express
export async function getTransactions() {
    const response = await fetch(API_URL);

    if (!response.ok) {
        throw new Error("Failed to retrieve transactions");
    }

    return response.json();
}

// Send a new transaction to Express
export async function addTransaction(transaction) {
    const response = await fetch(API_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(transaction)
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || "Failed to save transaction");
    }

    return data;
}
// Delete a transaction
export async function deleteTransaction(id) {
    const response = await fetch(
        `http://localhost:3001/api/transactions/${id}`,
        {
            method: "DELETE"
        }
    );

    const data = await response.json();

    if (!response.ok) {
        throw new Error(
            data.error || "Failed to delete transaction"
        );
    }

    return data;
}