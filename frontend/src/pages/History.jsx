import {useEffect,useState} from 'react';
import TransactionModal from '../components/TransactionModal';
import MonthPicker from '../components/MonthPicker';
import ConfirmDialog from '../components/ConfirmDialog';
import {getTransactions,deleteTransaction} from '../services/transactionService';
import {money,longDate,localToday} from '../utils/format';
import './History.css';

export default function History(){
 const [transactions,setTransactions]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const [open,setOpen]=useState(false),[editing,setEditing]=useState(null),[deleting,setDeleting]=useState(null),[busy,setBusy]=useState(false);
 const [search,setSearch]=useState(''),[type,setType]=useState('all'),[category,setCategory]=useState('all'),[month,setMonth]=useState('');
 async function refresh(){try{const data=await getTransactions();setTransactions(data);setError('');}catch(e){setError(e.message);}finally{setLoading(false);}}
 useEffect(()=>{refresh();const fn=()=>refresh();window.addEventListener('buynana:transactions-changed',fn);return()=>window.removeEventListener('buynana:transactions-changed',fn);},[]);
 const categories=[...new Set(transactions.map(t=>t.category))].sort();
 const filtered=transactions.filter(t=>{
  const s=search.trim().toLowerCase();return (!s||`${t.description} ${t.category}`.toLowerCase().includes(s))&&
   (type==='all'||t.type===type)&&(category==='all'||t.category===category)&&(!month||t.transaction_date.slice(0,7)===month);
 });
 const income=filtered.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0);
 const expenses=filtered.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);
 async function confirmDelete(){if(!deleting||busy)return;setBusy(true);try{await deleteTransaction(deleting.transaction_id);setDeleting(null);window.dispatchEvent(new Event('buynana:transactions-changed'));}catch(e){setError(e.message);setDeleting(null);}finally{setBusy(false);}}
 return <div className="history-page">
  <header className="page-header"><div><h1>Transaction history</h1><p className="page-subtitle">Search, review, and manage your recorded income and expenses.</p></div>
   <div className="page-header-actions"><span className="month-label">{filtered.length} transaction{filtered.length===1?'':'s'}</span><button type="button" className="btn btn--primary" onClick={()=>{setEditing(null);setOpen(true);}}>＋ Add transaction</button></div>
  </header>
  {error&&<p role="alert" className="notice notice--error">{error}</p>}
  <section className="history-filters card" aria-label="Transaction filters">
   <div className="history-filter-field history-search"><label htmlFor="history-search">Search</label><input id="history-search" type="search" value={search} placeholder="Search description or category" onChange={e=>setSearch(e.target.value)}/></div>
   <div className="history-filter-field"><label htmlFor="history-type">Type</label><select id="history-type" value={type} onChange={e=>setType(e.target.value)}><option value="all">All types</option><option value="income">Income</option><option value="expense">Expense</option></select></div>
   <div className="history-filter-field"><label htmlFor="history-category">Category</label><select id="history-category" value={category} onChange={e=>setCategory(e.target.value)}><option value="all">All categories</option>{categories.map(c=><option key={c}>{c}</option>)}</select></div>
   <div className="history-filter-field history-month-field"><span className="filter-label">Month / year</span><MonthPicker id="history" value={month} onChange={setMonth} allowAll/></div>
   <button type="button" className="btn btn--ghost history-clear-button" onClick={()=>{setSearch('');setType('all');setCategory('all');setMonth('');}}>Clear filters</button>
  </section>
  <section className="history-summary" aria-label="Filtered financial totals">
   <div className="history-summary-card"><span>Filtered income</span><strong className="money">{money(income)}</strong></div>
   <div className="history-summary-card"><span>Filtered expenses</span><strong className="money">{money(expenses)}</strong></div>
   <div className="history-summary-card history-summary-card--net"><span>Filtered net cash flow</span><strong className="money">{money(income-expenses)}</strong></div>
  </section>
  <section className="history-table-panel card"><div className="panel-header history-table-header"><h2>Transactions</h2><span className="muted">{filtered.length} shown</span></div>
   {loading?<p className="history-message" role="status">Loading transactions…</p>:filtered.length===0?<div className="empty-state"><h3>No matching transactions</h3><p>Try clearing your filters or record a new transaction.</p><button type="button" className="btn btn--secondary" onClick={()=>{setSearch('');setType('all');setCategory('all');setMonth('');}}>Clear filters</button></div>:
   <div className="history-table-scroll"><table className="history-table"><thead><tr><th scope="col">Date</th><th scope="col">Description</th><th scope="col">Category</th><th scope="col">Type</th><th scope="col">Repeats</th><th scope="col" className="number">Amount</th><th scope="col">Actions</th></tr></thead>
    <tbody>{filtered.map(t=><tr key={t.transaction_id}>
     <td><span className="history-date">{longDate(t.transaction_date)}</span>{t.transaction_date>localToday()&&<span className="type-badge type-badge--scheduled">Scheduled</span>}</td>
     <td className="history-description">{t.description}</td><td>{t.category}</td>
     <td><span className={`type-badge type-badge--${t.type}`}>{t.type==='income'?'↑ Income':'↓ Expense'}</span></td>
     <td>{t.is_recurring===1?<span className="type-badge type-badge--recurring" title="This transaction is marked to repeat">↻ {t.recurring_frequency||'Repeating'}</span>:<span className="muted">One-time</span>}</td>
     <td className={`number money ${t.type==='income'?'money--income':'money--expense'}`}>{t.type==='income'?'+':'−'}{money(t.amount)}</td>
     <td className="history-actions"><button type="button" className="btn btn--secondary btn--small" aria-label={`Edit ${t.description}`} onClick={()=>{setEditing(t);setOpen(true);}}>Edit</button>
      <button type="button" className="btn btn--danger btn--small" aria-label={`Delete ${t.description}`} onClick={()=>setDeleting(t)}>Delete</button></td>
    </tr>)}</tbody></table></div>}
  </section>
  <TransactionModal isOpen={open} initialTransaction={editing} onClose={()=>{setOpen(false);setEditing(null);}} onTransactionAdded={()=>window.dispatchEvent(new Event('buynana:transactions-changed'))}/>
  <ConfirmDialog open={Boolean(deleting)} title="Delete transaction?" onCancel={()=>setDeleting(null)} onConfirm={confirmDelete} busy={busy}>
   <p>Delete <strong>{deleting?.description}</strong> ({deleting?money(deleting.amount):''})? This action cannot be undone and will update your balances.</p>
  </ConfirmDialog>
 </div>;
}
