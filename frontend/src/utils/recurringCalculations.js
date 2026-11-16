// Convert recurring expenses into estimated monthly amounts
export function calculateMonthlyRecurringExpenses(transactions) {

    // Only include recurring expenses
    const recurringExpenses = transactions.filter(
        transaction =>
            transaction.type === "expense" &&
            transaction.is_recurring === 1
    );

    // Group matching recurring expenses
    const uniqueExpenses = new Map();

    recurringExpenses.forEach(transaction => {

        const key = [
            transaction.description.trim().toLowerCase(),
            transaction.category.trim().toLowerCase()
        ].join("|");

        const existing = uniqueExpenses.get(key);

        // Keep the most recent matching transaction
        if (
            !existing ||
            transaction.transaction_date > existing.transaction_date ||
            (
                transaction.transaction_date === existing.transaction_date &&
                transaction.transaction_id > existing.transaction_id
            )
        ) {
            uniqueExpenses.set(key, transaction);
        }
    });

    let monthlyTotal = 0;

    uniqueExpenses.forEach(transaction => {

        const amount = Number(transaction.amount);

        switch (transaction.recurring_frequency) {

            case "weekly":
                monthlyTotal += amount * 52 / 12;
                break;

            case "monthly":
                monthlyTotal += amount;
                break;

            case "yearly":
                monthlyTotal += amount / 12;
                break;

            default:
                break;
        }
    });

    return {
        monthlyTotal,
        recurringCount: uniqueExpenses.size
    };
}