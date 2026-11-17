import {Link} from 'react-router-dom';
import {money} from '../utils/format';
export default function BudgetOverview({budgets=[],loading,error,currentMonthExpenses=0}){
 const total=budgets.reduce((sum,b)=>sum+b.budget_amount,0);
 const spent=budgets.reduce((sum,b)=>sum+b.spent,0);
 const percent=total>0?Math.round(spent/total*100):0;
 if(loading)return <p role="status">Loading budgets…</p>;
 if(error)return <p className="notice notice--error" role="alert">{error}</p>;
 if(!budgets.length)return <div className="empty-state">
  <h3>No budget set for this month</h3>
  <p>You've recorded {money(currentMonthExpenses)} in expenses. Set category budgets to see how that spending compares with your limits.</p>
  <Link className="btn btn--primary" to="/budgets">＋ Create a budget</Link>
 </div>;
 return <div className="budget-overview">
   <div className="budget-overview__summary"><div><span className="budget-overview__label">Budgeted</span><strong className="money">{money(total)}</strong></div>
    <div><span className="budget-overview__label">Spent in budgeted categories</span><strong className="money">{money(spent)}</strong></div></div>
   <div className="budget-overview__progress" role="progressbar" aria-label="Budget used" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(percent,100)}><span style={{width:`${Math.min(percent,100)}%`}}/></div>
   <div className="budget-overview__progress-label"><span>{percent}% of category limits used</span><span>{money(total-spent)} remaining</span></div>
   <div className="budget-overview__categories">{budgets.slice(0,4).map(b=><div className="budget-overview__category" key={b.budget_id}>
    <span>{b.category}</span><strong className="money">{money(b.spent)} / {money(b.budget_amount)}</strong>
   </div>)}</div>
   <p className="budget-explainer">Budget spending covers only categories with a budget; other recorded expenses aren't included in this progress bar.</p>
 </div>;
}
