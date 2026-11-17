import {useEffect,useState} from 'react';
import SavingsGoals from '../components/SavingsGoals';
import ForecastChart from '../components/ForecastChart';
import {getForecastSuggestions,generateHybridForecast} from '../services/forecastService';
import {money,monthLabel} from '../utils/format';
import './Forecast.css';
const sourceLabels={manual_override:'Your estimate',historical_average:'Historical average',recurring_income:'Recurring income',historical_plus_recurring:'History + recurring bills',monthly_budget:'Budget suggestion',manual_input_required:'Needs an estimate',goal_plans:'Savings goal plans',no_planned_contributions:'No planned contribution'};
const friendlySource=s=>sourceLabels[s]||s?.replaceAll('_',' ')||'Not available';
const showMoney=x=>x==null?'Not available':money(x);
const numeric=v=>v.trim()===''?null:Number(v);
const controlKinds=[{key:'income',label:'Expected monthly income',kind:'Income'}, {key:'expenses',label:'Expected monthly expenses',kind:'Expenses'},{key:'savings',label:'Planned monthly savings',kind:'Savings'}];
export default function Forecast(){
 const [suggestions,setSuggestions]=useState(null),[result,setResult]=useState(null);
 const [values,setValues]=useState({income:'',expenses:'',savings:''});
 const [mode,setMode]=useState({income:'auto',expenses:'auto',savings:'auto'});
 const [months,setMonths]=useState(3),[confirmBudget,setConfirmBudget]=useState(false);
 const [loading,setLoading]=useState(true),[generating,setGenerating]=useState(false),[error,setError]=useState(''),[stale,setStale]=useState(false);
 async function load(){
  setLoading(true);
  try {
   const data=await getForecastSuggestions();
   // Old backend processes can return a legacy suggestions payload without savings.
   // Show an actionable message instead of crashing the entire Forecast page.
   if (!data?.income || !data?.expenses || !data?.recurring_expenses || !data?.savings) {
    throw new Error('The Forecast API is returning an older response. Stop the backend on port 3001, start it from this updated BuyNana folder, then refresh the page.');
   }
   setSuggestions(data);
   setError('');
   setStale(true);
  } catch(e) {
   setSuggestions(null);
   setError(e.message);
  } finally { setLoading(false); }
 }
 useEffect(()=>{load();const fn=()=>load();window.addEventListener('buynana:transactions-changed',fn);window.addEventListener('buynana:savings-changed',fn);return()=>{window.removeEventListener('buynana:transactions-changed',fn);window.removeEventListener('buynana:savings-changed',fn);};},[]);
 const invalidate=()=>{setStale(Boolean(result));setError('');};
 const usesBudget=mode.expenses==='auto'&&suggestions?.expenses.source==='monthly_budget';
 async function generate(event){event.preventDefault();setError('');
  if(usesBudget&&!confirmBudget){setError('Confirm that your monthly budget covers all your expected expenses, or choose Custom to enter a complete spending estimate.');return;}
  const input={expectedIncome:mode.income==='custom'?numeric(values.income):null,expectedExpenses:mode.expenses==='custom'?numeric(values.expenses):null,
   expectedSavings:mode.savings==='custom'?numeric(values.savings):null,months,confirmBudget:usesBudget&&confirmBudget};
  for(const [key,value] of Object.entries({expectedIncome:input.expectedIncome,expectedExpenses:input.expectedExpenses,expectedSavings:input.expectedSavings})){
   if(value!==null&&(!Number.isFinite(value)||value<0)){setError(`${key.replace('expected','Expected ')} must be a non-negative amount.`);return;}
  }
  setGenerating(true);
  try{const data=await generateHybridForecast(input);setResult(data);setStale(false);if(data.requires_user_input)setError(data.message||'Fill in missing expected amounts and try again.');}
  catch(e){setError(e.message);}finally{setGenerating(false);}
 }
 function setControlMode(key,kind){setMode(prev=>({...prev,[key]:kind}));if(key==='expenses')setConfirmBudget(false);invalidate();}
 const inputData={
  income:{amount:suggestions?.income.suggested_amount,source:suggestions?.income.source,help:'No income history yet? Choose Custom and enter what you expect to receive.'},
  expenses:{amount:suggestions?.expenses.suggested_amount,source:suggestions?.expenses.source,help:'Enter your TOTAL expected monthly spending, including regular bills.'},
  savings:{amount:suggestions?.savings?.suggested_amount,source:suggestions?.savings?.source,help:'Money moved into savings is no longer available to spend, but still counts toward your savings goals.'}
 };
 return <div className="forecast-page">
  <header className="page-header"><div><h1>Forecast</h1><p className="page-subtitle">Plan your cash flow, see what comes next, and stay on track with savings.</p></div>
   {suggestions&&<span className="month-label">Starting {monthLabel(suggestions.forecast_month)}</span>}
  </header>
  <section className="forecast-panel card" aria-labelledby="forecast-title">
   <div className="panel-header"><div><h2 id="forecast-title">Your financial outlook</h2><p className="page-subtitle">Start with your recorded data. Edit assumptions as needed.</p></div></div>
   {loading?<p role="status">Loading forecast suggestions…</p>:suggestions&&<>
    <div className="forecast-suggestions">
     <article className="forecast-suggestion-card"><span>Available to spend today</span><strong>{showMoney(suggestions.starting_balance)}</strong><small>After actual expenses and savings</small></article>
     <article className="forecast-suggestion-card"><span>Suggested income / month</span><strong>{showMoney(suggestions.income.suggested_amount)}</strong><small>{suggestions.income.suggested_amount==null?'No past full month — add an income estimate':friendlySource(suggestions.income.source)}</small></article>
     <article className="forecast-suggestion-card"><span>Suggested spending / month</span><strong>{showMoney(suggestions.expenses.suggested_amount)}</strong><small>{suggestions.expenses.suggested_amount==null?'Add expense history, a monthly budget, or use Custom':friendlySource(suggestions.expenses.source)}</small></article>
     <article className="forecast-suggestion-card"><span>Recurring costs / month</span><strong>{showMoney(suggestions.recurring_expenses.monthly_equivalent)}</strong><small>Already included in any full spending estimate</small></article>
     <article className="forecast-suggestion-card"><span>Planned goal savings / month</span><strong>{showMoney(suggestions.savings?.suggested_amount)}</strong><small>Set aside for goals, not ordinary spending</small></article>
    </div>
    <form className="forecast-form" onSubmit={generate}>
     <div className="forecast-input-grid">
      {controlKinds.map(ctrl=>{const item=inputData[ctrl.key];return <div className="forecast-input-group" key={ctrl.key}>
       <div className="forecast-input-heading"><label htmlFor={`forecast-${ctrl.key}`}>{ctrl.label}</label><div className="mode-switch" role="group" aria-label={`${ctrl.label} source`}>
        <button type="button" className={mode[ctrl.key]==='auto'?'selected':''} aria-pressed={mode[ctrl.key]==='auto'} onClick={()=>setControlMode(ctrl.key,'auto')}>Auto</button>
        <button type="button" className={mode[ctrl.key]==='custom'?'selected':''} aria-pressed={mode[ctrl.key]==='custom'} onClick={()=>setControlMode(ctrl.key,'custom')}>Custom</button>
       </div></div>
       {mode[ctrl.key]==='custom'?<div className="currency-input"><span aria-hidden="true">$</span><input id={`forecast-${ctrl.key}`} type="number" inputMode="decimal" min="0" step="0.01" required placeholder="0.00" value={values[ctrl.key]}
        onChange={e=>{setValues(prev=>({...prev,[ctrl.key]:e.target.value}));invalidate();}}/></div>:
        <div className={`automatic-field ${item.amount==null?'automatic-field--missing':''}`} id={`forecast-${ctrl.key}`} aria-live="polite">
          <span>{item.amount==null?'Not available':money(item.amount)}</span><small>Auto · {friendlySource(item.source)}</small></div>}
       <p className="field-help">{item.help}</p>
      </div>})}
      <div className="forecast-input-group"><label htmlFor="forecastHorizon">Forecast length</label><select id="forecastHorizon" value={months} onChange={e=>{setMonths(Number(e.target.value));invalidate();}}>
       <option value={1}>1 month</option><option value={3}>3 months</option><option value={6}>6 months</option><option value={12}>12 months</option></select><p className="field-help">See how your available balance changes over time.</p></div>
     </div>
     {usesBudget&&<div className="forecast-expense-confirmation"><p className="notice">Your budget suggestion may include only some categories. Make sure it covers <strong>all</strong> expected spending, including rent and subscriptions.</p>
      <label className="forecast-confirmation-label"><input type="checkbox" checked={confirmBudget} onChange={e=>{setConfirmBudget(e.target.checked);invalidate();}}/><span>I've checked that this budget amount covers my total expected monthly expenses.</span></label>
     </div>}
     <div className="forecast-form-actions"><button className="btn btn--primary" disabled={generating||loading} type="submit">{generating?'Calculating…':'↗ Generate forecast'}</button>
      <span className="muted">Estimates only · No financial records are changed</span></div>
    </form>
   </>}
   {error&&<p role="alert" className="notice notice--error forecast-error">{error}</p>}
   {result&&!result.requires_user_input&&<section className={`forecast-results ${stale?'forecast-results--stale':''}`} aria-labelledby="forecast-results-title">
    <div className="panel-header"><div><h2 id="forecast-results-title">Forecast results</h2><p className="page-subtitle">Based on your latest selected assumptions</p></div><span className="month-label">{result.forecast_horizon} month scenario</span></div>
    {stale&&<p className="notice" role="status"><strong>Results out of date.</strong> Your assumptions have changed. Select <em>Generate forecast</em> to update these numbers.</p>}
    <div className="forecast-results-grid">
     <article className="forecast-result-card"><span>First-month income</span><strong>{showMoney(result.predicted_income)}</strong></article>
     <article className="forecast-result-card"><span>First-month expenses</span><strong>{showMoney(result.predicted_expenses)}</strong></article>
     <article className="forecast-result-card"><span>First-month savings</span><strong>{showMoney(result.predicted_savings)}</strong></article>
     <article className="forecast-result-card forecast-balance"><span>Available after {result.forecast_horizon} month{result.forecast_horizon===1?'':'s'}</span><strong>{showMoney(result.monthly_projection.at(-1)?.projected_ending_balance)}</strong></article>
    </div>
    <p className="forecast-assumption"><strong>Important assumption:</strong> Projections start from your available balance recorded today, and model the next full calendar months. Remaining transactions in the current month aren't predicted. Savings reduce spendable money but remain allocated to your goals.</p>
    <div className="forecast-sources"><span><strong>Income:</strong> {friendlySource(result.income_source)}</span><span><strong>Spending:</strong> {friendlySource(result.expense_source)}</span><span><strong>Savings:</strong> {friendlySource(result.savings_source)}</span><span><strong>Data quality:</strong> {String(result.data_quality||'unverified').replaceAll('_',' ')}</span></div>
    <ForecastChart rows={result.monthly_projection}/>
    {result.income_variability!=null&&<p className="forecast-model-note">Past monthly income varied by approximately {money(result.income_variability)} (standard deviation); this does not guarantee future outcomes.</p>}
    {result.monthly_projection?.[0]?.categories?.length>0&&<details className="forecast-seasonal-breakdown"><summary>Category spending &amp; seasonal factors</summary>
     <p className="muted">A factor of 1.000 is neutral. Seasonal adjustments require two full years of recorded activity.</p>
     <div className="forecast-projection-table"><table><thead><tr><th>Category</th><th>Monthly average</th><th>Seasonal factor</th><th>Forecast</th></tr></thead><tbody>
      {result.monthly_projection[0].categories.map(c=><tr key={c.category}><td>{c.category}</td><td>{money(c.historical_average)}</td><td>{c.seasonal_factor.toFixed(3)}{c.sufficient_seasonal_history?'':' (neutral)'}</td><td>{money(c.predicted_spending)}</td></tr>)}
     </tbody></table></div></details>}
    {result.monthly_projection.some(r=>r.projected_ending_balance<0)&&<p className="notice notice--error" role="status">⚠ Your available balance is projected to go below $0. Review your planned spending and savings.</p>}
   </section>}
  </section>
  <section className="forecast-savings-section" aria-label="Savings goals"><SavingsGoals/></section>
 </div>;
}
