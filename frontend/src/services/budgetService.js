const API_URL = "/api/budgets";

// Retrieve budgets for a selected month
export async function getBudgets(month) {
    const response = await fetch(
        `${API_URL}?month=${encodeURIComponent(month)}`
    );

    if (!response.ok) {
        throw new Error("Failed to retrieve budgets");
    }

    return response.json();
}

// Create a new monthly budget
export async function addBudget(budget) {
    const response = await fetch(API_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(budget)
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || "Failed to create budget");
    }

    return data;
}
export async function updateBudget(id, budget) {
    const response = await fetch(`${API_URL}/${id}`, {
        method: 'PUT', headers: {'Content-Type':'application/json'}, body:JSON.stringify(budget)
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Unable to update budget');
    return data;
}
export async function deleteBudget(id) {
    const response = await fetch(`${API_URL}/${id}`, {method:'DELETE'});
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Unable to delete budget');
    return data;
}
