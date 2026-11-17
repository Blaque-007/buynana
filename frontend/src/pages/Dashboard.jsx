import {useEffect,useState} from 'react';
import {Link} from 'react-router-dom';
import BudgetOverview from '../components/BudgetOverview';
import TransactionModal from '../components/TransactionModal';
import {getTransactions} from '../services/transactionService';
import {getBudgets} from '../services/budgetService';
import {getSavingsSummary} from '../services/savingsService';
import {calculateMonthlyRecurringExpenses} from '../utils/recurringCalculations';
import {money,longDate,monthLabel,localMonth,localToday} from '../utils/format';
import './Dashboard.css';

export default function Dashboard(){
 const [transactions,setTransactions]=useState([]);
 const [budgets,setBudgets]=useState([]);
 const [savings,setSavings]=useState({total_saved:0,monthly_saved:0});
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 const [budgetError,setBudgetError]=useState('');
 const [savingsError,setSavingsError]=useState('');
 const [open,setOpen]=useState(false);
 const currentMonth=localMonth(), today=localToday();
 async function refresh(){
  const results=await Promise.allSettled([getTransactions(),getBudgets(localMonth()),getSavingsSummary(localMonth())]);
  if(results[0].status==='fulfilled'){setTransactions(results[0].value);setError('');}else setError('Could not load transactions. Check that the backend is running.');
  if(results[1].status==='fulfilled'){setBudgets(results[1].value);setBudgetError('');}else setBudgetError('Budgets are temporarily unavailable.');
  if(results[2].status==='fulfilled'){setSavings(results[2].value);setSavingsError('');}else setSavingsError('Savings totals are temporarily unavailable.');
  setLoading(false);
 }
 useEffect(()=>{refresh();const handler=()=>refresh();window.addEventListener('buynana:transactions-changed',handler);return()=>window.removeEventListener('buynana:transactions-changed',handler);},[]);
 const posted=transactions.filter(t=>t.transaction_date<=today);
 const allIncome=posted.filter(t=>t.type==='income').reduce((a,t)=>a+t.amount,0);
 const allExpenses=posted.filter(t=>t.type==='expense').reduce((a,t)=>a+t.amount,0);
 const monthIncome=posted.filter(t=>t.type==='income'&&t.transaction_date.startsWith(currentMonth)).reduce((a,t)=>a+t.amount,0);
 const monthExpenses=posted.filter(t=>t.type==='expense'&&t.transaction_date.startsWith(currentMonth)).reduce((a,t)=>a+t.amount,0);
 const recurring=calculateMonthlyRecurringExpenses(posted).monthlyTotal;
 const available=allIncome-allExpenses-(savings.total_saved||0);
 const rate=monthIncome>0?100*(savings.monthly_saved||0)/monthIncome:null;
 const recent=transactions.slice(0,5);
 return <div className="dashboard-page">
  <header className="page-header">
   <div><h1>Dashboard</h1><p className="page-subtitle">A clear picture of where your money stands.</p></div>
   <div className="page-header-actions"><span className="month-label">{monthLabel(currentMonth)}</span><button className="btn btn--primary" onClick={()=>setOpen(true)}>＋ Add transaction</button></div>
  </header>
  {error&&<p role="alert" className="notice notice--error">{error}</p>}
  {loading?<p role="status">Loading your financial overview…</p>:<>
   <section className="dashboard-summary" aria-label="Financial snapshot">
    <article className="financial-card"><span className="financial-card__title">Available balance</span><strong className="financial-card__value money">{savingsError?'Unavailable':money(available)}</strong><span className="financial-card__hint">Recorded income − expenses − savings</span></article>
    <article className="financial-card"><span className="financial-card__title">Income this month</span><strong className="financial-card__value money">{money(monthIncome)}</strong><span className="financial-card__hint">Received through today</span></article>
    <article className="financial-card"><span className="financial-card__title">Recurring expenses</span><strong className="financial-card__value money">{money(recurring)}</strong><span className="financial-card__hint">Estimated monthly equivalent</span></article>
    <article className="financial-card"><span className="financial-card__title">Savings rate</span><strong className="financial-card__value money">{savingsError?'Unavailable':rate===null?'—':`${rate.toFixed(1)}%`}</strong><span className="financial-card__hint">{rate===null?'No income recorded this month':'Savings added ÷ income this month'}</span></article>
   </section>
   {savingsError&&<p role="alert" className="notice notice--error">{savingsError}</p>}
   <section className="dashboard-content">
    <article className="dashboard-panel"><div className="panel-header"><h2>Budget overview</h2><Link className="section-link" to="/budgets">All budgets →</Link></div>
     <p className="panel-intro">{monthLabel(currentMonth)} · {money(monthExpenses)} spent across recorded expenses.</p>
     <BudgetOverview budgets={budgets} loading={false} error={budgetError} currentMonthExpenses={monthExpenses}/>
    </article>
    <article className="dashboard-panel"><div className="panel-header"><h2>Recent transactions</h2><Link className="section-link" to="/history">View all →</Link></div>
     {recent.length===0?<div className="empty-state"><h3>No transactions yet</h3><p>Record your first income or expense to see your activity here.</p><button className="btn btn--primary" onClick={()=>setOpen(true)}>＋ Add transaction</button></div>
      :<div className="recent-transactions">{recent.map(t=><div className="recent-transaction" key={t.transaction_id}>
       <span className={`transaction-symbol ${t.type==='income'?'transaction-symbol--income':'transaction-symbol--expense'}`} aria-hidden="true">{t.type==='income'?'↑':'↓'}</span>
       <div className="recent-transaction__detail"><strong>{t.description}</strong><span>{t.category} · {longDate(t.transaction_date)} {t.transaction_date>today?'· Scheduled':''}</span></div>
       <strong className={`money recent-transaction__amount ${t.type==='income'?'money--income':'money--expense'}`} aria-label={`${t.type} ${money(t.amount)}`}>
        {t.type==='income'?'+':'−'}{money(t.amount)}</strong>
      </div>)}</div>}
    </article>
   </section>
   <div className="dashboard-footnote">Scheduled future-dated transactions appear in History but do not change today's available balance or this month's recorded spending.</div>
  </>}
  <TransactionModal isOpen={open} onClose={()=>setOpen(false)} onTransactionAdded={()=>window.dispatchEvent(new Event('buynana:transactions-changed'))}/>
 </div>;
}
