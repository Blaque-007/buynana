const API_URL = "http://localhost:3001/api/savings";

// Reusable helper for handling API responses
async function handleResponse(response) {
    const data = await response.json();

    if (!response.ok) {
        throw new Error(
            data.error || "Something went wrong with the savings request"
        );
    }

    return data;
}

// Retrieve all active savings goals
export async function getSavingsGoals() {
    const response = await fetch(`${API_URL}/goals`);

    return handleResponse(response);
}

// Create a new savings goal
export async function createSavingsGoal(goal) {
    const response = await fetch(`${API_URL}/goals`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(goal),
    });

    return handleResponse(response);
}

// Update an existing savings goal
export async function updateSavingsGoal(goalId, goal) {
    const response = await fetch(`${API_URL}/goals/${goalId}`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(goal),
    });

    return handleResponse(response);
}

// Archive a savings goal
export async function deleteSavingsGoal(goalId) {
    const response = await fetch(`${API_URL}/goals/${goalId}`, {
        method: "DELETE",
    });

    return handleResponse(response);
}

// Allocate money toward a savings goal
export async function addSavingsContribution(goalId, amount) {
    const response = await fetch(
        `${API_URL}/goals/${goalId}/contributions`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ amount }),
        }
    );

    return handleResponse(response);
}
// Retrieve total and monthly savings contributions
export async function getSavingsSummary(month) {
    const response = await fetch(
        `${API_URL}/summary?month=${encodeURIComponent(month)}`
    );

    return handleResponse(response);
}