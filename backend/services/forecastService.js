/** BuyNana forecasting engine: financial calculations are estimates, not bank balances. */
const db = require('../database/db');
const { calculateSeasonalFactor } = require('./seasonalService');

const money = value => Math.round((Number(value) + Number.EPSILON) * 100) / 100;
const validMoney = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const monthKey = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
const dateKey = date => `${monthKey(date)}-${String(date.getDate()).padStart(2, '0')}`;
const nextMonthKey = (offset = 1, now = new Date()) => monthKey(new Date(now.getFullYear(), now.getMonth() + offset, 1));
const safeDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : null;
const sameDescription = transaction => [transaction.type, transaction.description.trim().toLowerCase().replace(/\s+/g,' '), transaction.category.trim().toLowerCase()].join('|');

function getMonthlyFinancialHistory() {
    return db.prepare(`SELECT substr(transaction_date,1,7) AS month,
      ROUND(SUM(CASE WHEN type='income' THEN amount ELSE 0 END),2) AS income,
      ROUND(SUM(CASE WHEN type='expense' THEN amount ELSE 0 END),2) AS expenses
      FROM transactions WHERE transaction_date <= ? GROUP BY substr(transaction_date,1,7) ORDER BY month`).all(dateKey(new Date()))
      .map(r => ({...r, net_cash_flow: money(r.income - r.expenses)}));
}

function completedActivityMonths(now = new Date()) {
    const today = dateKey(now);
    const current = monthKey(now);
    return db.prepare(`SELECT DISTINCT substr(transaction_date,1,7) AS month
      FROM transactions WHERE transaction_date <= ? AND substr(transaction_date,1,7) < ?
      ORDER BY month`).all(today,current).map(r=>r.month);
}

function calculateHistoricalAverageForecast(startingBalance = 0) {
    if (typeof startingBalance !== 'number' || !Number.isFinite(startingBalance))
        throw new Error('Starting balance must be a valid number.');
    const months = new Set(completedActivityMonths());
    const history = getMonthlyFinancialHistory().filter(row => months.has(row.month));
    if (!history.length) return {method:'expected_cash_flow',historical_months:0,average_income:null,average_expenses:null,
        predicted_income:null,predicted_expenses:null,starting_balance:money(startingBalance),projected_ending_balance:null,
        message:'No completed historical months available. Expected income and expenses are required.'};
    const income = money(history.reduce((sum,r)=>sum+r.income,0)/history.length);
    const expenses = money(history.reduce((sum,r)=>sum+r.expenses,0)/history.length);
    const variability = money(Math.sqrt(history.reduce((sum,r)=>sum+(r.income-income)**2,0)/history.length));
    return {method:'historical_average',historical_months:history.length, average_income:income,average_expenses:expenses,
        predicted_income:income,predicted_expenses:expenses,income_variability:variability,starting_balance:money(startingBalance),
        projected_ending_balance:money(startingBalance+income-expenses)};
}

function getAvailableBalance(asOf = dateKey(new Date())) {
    const net = db.prepare(`SELECT COALESCE(SUM(CASE WHEN type='income' THEN amount ELSE -amount END),0) AS total
      FROM transactions WHERE transaction_date <= ?`).get(asOf).total;
    const saved = db.prepare(`SELECT COALESCE(SUM(amount),0) AS total
      FROM savings_contributions WHERE contribution_date <= ?`).get(asOf).total;
    return money(net-saved);
}

function getRecurringTransactions(type = 'expense', asOf = dateKey(new Date())) {
    const rows = db.prepare(`SELECT * FROM transactions WHERE type=? AND is_recurring=1
      AND recurring_frequency IN ('weekly','monthly','yearly') AND transaction_date <= ?
      ORDER BY transaction_date DESC,transaction_id DESC`).all(type,asOf);
    const map = new Map();
    for (const row of rows) if (!map.has(sameDescription(row))) map.set(sameDescription(row),row);
    return [...map.values()];
}
function getRecurringExpenses() { return getRecurringTransactions('expense'); }

function recurrenceDueAmount(transaction, month) {
    const [year,monthNumber] = month.split('-').map(Number);
    const anchor = safeDate(transaction.transaction_date);
    if (!anchor || Number.isNaN(anchor.getTime())) return 0;
    const lastDay = new Date(year,monthNumber,0).getDate();
    const amount = Number(transaction.amount);
    if (transaction.recurring_frequency === 'monthly') {
        const day = Math.min(anchor.getDate(),lastDay);
        const due = new Date(year,monthNumber-1,day,12);
        return due >= anchor ? amount : 0;
    }
    if (transaction.recurring_frequency === 'yearly') {
        if (anchor.getMonth()+1 !== monthNumber) return 0;
        const day = Math.min(anchor.getDate(),lastDay);
        const due = new Date(year,monthNumber-1,day,12);
        return due >= anchor ? amount : 0;
    }
    if (transaction.recurring_frequency === 'weekly') {
        const start = new Date(year, monthNumber-1,1,12);
        const end = new Date(year,monthNumber-1,lastDay,12);
        const startOffset = Math.max(0,Math.ceil((start-anchor)/(86400000*7)));
        let count = 0;
        for(let week=startOffset;week<startOffset+6;week++) {
            const due = new Date(anchor.getTime()+week*86400000*7);
            if(due>=start && due<=end) count++;
        }
        return money(count*amount);
    }
    return 0;
}

function getScheduledRecurringAmount(month, type = 'expense') {
    return money(getRecurringTransactions(type).reduce((s,r)=>s+recurrenceDueAmount(r,month),0));
}
function calculateMonthlyRecurringExpenses() {
    const expenses = getRecurringExpenses().map(r=>({
        ...r, monthly_equivalent: money(r.amount * (r.recurring_frequency === 'weekly' ? 52/12 : r.recurring_frequency === 'yearly' ? 1/12 : 1))
    }));
    return {recurring_count:expenses.length,total_monthly_recurring:money(expenses.reduce((s,r)=>s+r.monthly_equivalent,0)),expenses,
        note:'Description/category matching is an approximation; a dedicated schedule ID is recommended for production.'};
}

function getMonthlyNonRecurringExpenses() {
    return db.prepare(`SELECT substr(transaction_date,1,7) AS month,
      ROUND(SUM(CASE WHEN type='expense' AND COALESCE(is_recurring,0)=0 THEN amount ELSE 0 END),2) AS expenses,
      COUNT(*) AS transaction_count FROM transactions
      WHERE transaction_date <= ? GROUP BY substr(transaction_date,1,7) ORDER BY month`).all(dateKey(new Date()));
}
function calculateAverageNonRecurringExpenses() {
    const months = new Set(completedActivityMonths());
    const rows = getMonthlyNonRecurringExpenses().filter(r=>months.has(r.month));
    if(!rows.length) return {historical_months:0,average_nonrecurring_expenses:0,has_history:false,data_quality:'insufficient_history'};
    return {historical_months:rows.length, average_nonrecurring_expenses:money(rows.reduce((s,r)=>s+r.expenses,0)/rows.length),
        has_history:true,data_quality:'activity_based',message:'Months with activity are used; record completeness has not been verified.'};
}
function calculateCombinedExpenseForecast() {
    const nonrec = calculateAverageNonRecurringExpenses();
    const rec = calculateMonthlyRecurringExpenses();
    return {method:'historical_plus_recurring',historical_months:nonrec.historical_months,
        average_nonrecurring_expenses:nonrec.average_nonrecurring_expenses,
        predicted_recurring_expenses:rec.total_monthly_recurring,
        predicted_total_expenses:money(nonrec.average_nonrecurring_expenses+rec.total_monthly_recurring),
        recurring_count:rec.recurring_count,has_nonrecurring_history:nonrec.has_history,data_quality:nonrec.data_quality};
}
function getAverageNonRecurringExpensesByCategory() {
    const months = completedActivityMonths();
    if(!months.length) return {historical_months:0,categories:[]};
    const current = monthKey(new Date());
    const categories = db.prepare(`SELECT category,ROUND(SUM(amount),2) AS total_spending FROM transactions
      WHERE type='expense' AND is_recurring=0 AND substr(transaction_date,1,7) < ?
      GROUP BY category COLLATE NOCASE ORDER BY category`).all(current).map(r=>({
        category:r.category,total_spending:money(r.total_spending), average_monthly_spending:money(r.total_spending/months.length)
    }));
    return {historical_months:months.length,categories};
}
function calculateSeasonallyAdjustedExpenses(targetMonth, month = null) {
    if (!Number.isInteger(targetMonth) || targetMonth<1 || targetMonth>12) throw new Error('Target month must be between 1 and 12.');
    const data = getAverageNonRecurringExpensesByCategory();
    const categories = data.categories.map(r=>{
        const season = calculateSeasonalFactor(r.category,targetMonth);
        return {category:r.category,historical_average:r.average_monthly_spending,seasonal_factor:season.seasonal_factor,
            predicted_spending:money(r.average_monthly_spending*season.seasonal_factor),sufficient_seasonal_history:season.sufficient_history};
    });
    const nonrec = money(categories.reduce((s,c)=>s+c.predicted_spending,0));
    const recurring = month ? getScheduledRecurringAmount(month) : calculateMonthlyRecurringExpenses().total_monthly_recurring;
    return {method:'seasonally_adjusted',target_month:targetMonth,historical_months:data.historical_months,
        predicted_nonrecurring_expenses:nonrec,predicted_recurring_expenses:recurring,
        predicted_total_expenses:money(nonrec+recurring),recurring_count:getRecurringExpenses().length,categories,
        data_quality:data.historical_months ? 'activity_based' : 'insufficient_history'};
}
function calculateExpectedCashFlow({startingBalance=0,expectedIncome,expectedExpenses,expectedSavings=0}={}) {
    if (typeof startingBalance !== 'number'||!Number.isFinite(startingBalance)) throw new Error('Starting balance must be a valid number.');
    if(!validMoney(expectedIncome))throw new Error('Expected income must be a non-negative number.');
    if(!validMoney(expectedExpenses))throw new Error('Expected expenses must be a non-negative number.');
    if(!validMoney(expectedSavings))throw new Error('Expected savings must be a non-negative number.');
    return {method:'expected_cash_flow',starting_balance:money(startingBalance),predicted_income:money(expectedIncome),
      predicted_expenses:money(expectedExpenses),predicted_savings:money(expectedSavings),
      projected_ending_balance:money(startingBalance+expectedIncome-expectedExpenses-expectedSavings),
      data_quality:'user_provided',message:'Scenario uses user-provided expectations.'};
}

function getForecastSuggestions() {
    const forecastMonth = nextMonthKey();
    const startingBalance = getAvailableBalance();
    const historical = calculateHistoricalAverageForecast(startingBalance);
    const budgetRows = db.prepare(`SELECT category,budget_amount,budget_month FROM budgets WHERE budget_month=? ORDER BY category`).all(forecastMonth);
    const totalBudget = money(budgetRows.reduce((s,b)=>s+b.budget_amount,0));
    const incoming = getRecurringTransactions('income');
    const incomeEstimate = historical.predicted_income ?? (incoming.length ? getScheduledRecurringAmount(forecastMonth,'income') : null);
    const recurring = calculateMonthlyRecurringExpenses();
    const expenseEstimate = historical.predicted_income !== null
      ? calculateSeasonallyAdjustedExpenses(Number(forecastMonth.slice(5)),forecastMonth).predicted_total_expenses
      : budgetRows.length ? totalBudget : null;
    const expenseSource = historical.predicted_income !== null ? 'historical_plus_recurring' : budgetRows.length ? 'monthly_budget' : 'manual_input_required';
    const goals = db.prepare(`SELECT goal_id, goal_name, target_amount,monthly_allocation,
      COALESCE((SELECT SUM(amount) FROM savings_contributions WHERE goal_id=g.goal_id),0) AS saved_amount
      FROM savings_goals g WHERE is_archived=0 ORDER BY goal_id`).all();
    const planned = money(goals.reduce((s,g)=>s+Math.min(g.monthly_allocation,Math.max(0,g.target_amount-g.saved_amount)),0));
    return {forecast_month:forecastMonth,starting_balance:startingBalance,
      income:{suggested_amount:incomeEstimate,variability:historical.income_variability ?? null,source:historical.predicted_income!==null?'historical_average':incoming.length?'recurring_income':'manual_input_required',available:incomeEstimate!==null},
      expenses:{suggested_amount:expenseEstimate,source:expenseSource,available:expenseEstimate!==null,budgets:budgetRows,
        requires_confirmation: expenseSource==='monthly_budget'},
      recurring_expenses:{monthly_equivalent:recurring.total_monthly_recurring,recurring_count:recurring.recurring_count,available:recurring.recurring_count>0},
      savings:{suggested_amount:planned,source:planned>0?'goal_plans':'no_planned_contributions',active_goals:goals.length},
      requires_user_input:incomeEstimate===null||expenseEstimate===null,
      assumptions:['Starting balance reflects transactions and savings recorded through today.','Current-month remaining cash flow is not estimated.',
        'Budget suggestions may not cover all expenses; user confirmation is required.',
        'Recurring commitments are estimated from tagged transactions.']};
}

function generateFinancialForecast() {
    const suggestions=getForecastSuggestions();
    const forecast=calculateHybridForecast({confirmBudget:false,months:1});
    return {...forecast,method:forecast.requires_user_input?'expected_cash_flow':'historical_plus_recurring',
      forecast_month:suggestions.forecast_month};
}

function calculateHybridForecast({expectedIncome=null,expectedExpenses=null,expectedSavings=null,confirmBudget=false,months=3}={}) {
    for (const [field,value] of [['Expected income',expectedIncome],['Expected expenses',expectedExpenses],['Expected savings',expectedSavings]]) {
        if(value!==null&&!validMoney(value))throw new Error(`${field} must be a non-negative number.`);
    }
    if(!Number.isInteger(months)||months<1||months>12)throw new Error('Forecast horizon must be between 1 and 12 months.');
    if(typeof confirmBudget!=='boolean') throw new Error('Budget confirmation must be true or false.');
    const suggestion=getForecastSuggestions();
    const incoming=expectedIncome!==null?expectedIncome:suggestion.income.suggested_amount;
    const outgoing=expectedExpenses!==null?expectedExpenses:suggestion.expenses.suggested_amount;
    const sourceIncome=expectedIncome!==null?'manual_override':suggestion.income.source;
    const sourceExpenses=expectedExpenses!==null?'manual_override':suggestion.expenses.source;
    const needsConfirmation = expectedExpenses===null && suggestion.expenses.source==='monthly_budget' && !confirmBudget;
    if(incoming===null||outgoing===null||needsConfirmation) return {
        forecast_month:suggestion.forecast_month,method:'hybrid_forecast',starting_balance:suggestion.starting_balance,
        predicted_income:incoming,predicted_expenses:outgoing,predicted_savings:expectedSavings??suggestion.savings.suggested_amount,
        projected_ending_balance:null,income_source:sourceIncome,expense_source:sourceExpenses,
        requires_user_input:true,requires_expense_confirmation:needsConfirmation,monthly_projection:[],
        message:needsConfirmation?'Confirm the budget covers your full expected spending, or enter total expected expenses.':
          'Enter missing expected income or expenses to generate a forecast.'};
    const plans=db.prepare(`SELECT g.goal_id,g.target_amount,g.monthly_allocation,
      COALESCE((SELECT SUM(c.amount) FROM savings_contributions c WHERE c.goal_id=g.goal_id),0) AS saved
      FROM savings_goals g WHERE g.is_archived=0 ORDER BY g.goal_id`).all();
    const planRemaining=new Map(plans.map(g=>[g.goal_id,Math.max(0,money(g.target_amount-g.saved))]));
    let balance=suggestion.starting_balance;
    const projections=[];
    for(let index=1;index<=months;index++) {
        const month=nextMonthKey(index);
        const monthlyExpenseForecast=calculateSeasonallyAdjustedExpenses(Number(month.slice(5)),month);
        const usesAutomaticExpenses=expectedExpenses===null && suggestion.expenses.source==='historical_plus_recurring';
        const expenses=usesAutomaticExpenses?monthlyExpenseForecast.predicted_total_expenses:outgoing;
        const income=expectedIncome===null && sourceIncome==='recurring_income' ? getScheduledRecurringAmount(month,'income') : incoming;
        let savings=0;
        if(expectedSavings!==null) savings=expectedSavings;
        else for(const goal of plans){
            const allocation=money(Math.min(goal.monthly_allocation,planRemaining.get(goal.goal_id)));
            savings+=allocation;planRemaining.set(goal.goal_id,money(planRemaining.get(goal.goal_id)-allocation));
        }
        savings=money(savings);
        const start=money(balance);
        balance=money(balance+income-expenses-savings);
        projections.push({month,starting_balance:start,predicted_income:money(income),predicted_expenses:money(expenses),
            predicted_savings:savings,projected_ending_balance:balance,
            predicted_recurring_expenses:usesAutomaticExpenses?monthlyExpenseForecast.predicted_recurring_expenses:null,
            predicted_nonrecurring_expenses:usesAutomaticExpenses?monthlyExpenseForecast.predicted_nonrecurring_expenses:null,
            seasonal_adjustments_applied:usesAutomaticExpenses&&monthlyExpenseForecast.categories.some(c=>c.sufficient_seasonal_history&&c.seasonal_factor!==1),
            categories:usesAutomaticExpenses?monthlyExpenseForecast.categories:[]});
    }
    const first=projections[0];
    return {forecast_month:first.month,method:'hybrid_forecast',starting_balance:first.starting_balance,
      predicted_income:first.predicted_income,predicted_expenses:first.predicted_expenses,predicted_savings:first.predicted_savings,
      predicted_recurring_expenses:first.predicted_recurring_expenses,predicted_nonrecurring_expenses:first.predicted_nonrecurring_expenses,
      projected_ending_balance:first.projected_ending_balance,income_source:sourceIncome,expense_source:sourceExpenses,
      savings_source:expectedSavings!==null?'manual_override':suggestion.savings.source,
      requires_user_input:false,requires_expense_confirmation:false,seasonal_adjustments_applied:first.seasonal_adjustments_applied,
      forecast_horizon:months,monthly_projection:projections, income_variability:expectedIncome===null?suggestion.income.variability:null, data_quality: sourceExpenses==='monthly_budget'?'budget_confirmed':
        sourceExpenses==='manual_override'?'user_provided':'activity_based',
      message:'Scenario forecast from today’s recorded balance. Remaining current-month cash flow is not included; future-month assumptions repeat unless changed.'};
}
module.exports={getMonthlyFinancialHistory,calculateHistoricalAverageForecast,getAvailableBalance,generateFinancialForecast,
  getRecurringExpenses,calculateMonthlyRecurringExpenses,getMonthlyNonRecurringExpenses,calculateAverageNonRecurringExpenses,
  calculateCombinedExpenseForecast,getAverageNonRecurringExpensesByCategory,calculateSeasonallyAdjustedExpenses,
  calculateExpectedCashFlow,getForecastSuggestions,calculateHybridForecast,getScheduledRecurringAmount,
  recurrenceDueAmount};
