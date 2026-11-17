import {useState} from 'react';
import {money,monthLabel} from '../utils/format';
const brief=v=>{const n=Math.abs(v);return (v<0?'-':'')+'$'+(n>=1000?(n/1000).toLocaleString('en-US',{maximumFractionDigits:1})+'k':Math.round(n).toLocaleString('en-US'));};
function roundStep(value){if(value<=0)return 100;const power=10**Math.floor(Math.log10(value));const x=value/power;return (x<=1?1:x<=2?2:x<=5?5:10)*power;}
export default function ForecastChart({rows}){
 const [hover,setHover]=useState(null);
 if(!rows?.length)return null;
 const count=rows.length,width=Math.max(720,100+count*74),height=280,left=71,right=24,top=24,bottom=55;
 const plotW=width-left-right,plotH=height-top-bottom,x=i=>left+(i+.5)*plotW/count;
 const cashMax=Math.max(1,...rows.flatMap(r=>[r.predicted_income,r.predicted_expenses,r.predicted_savings]));
 const cashStep=roundStep(cashMax/4),cashTop=Math.ceil(cashMax/cashStep)*cashStep;
 const cashY=value=>top+plotH-(Math.max(0,value)/cashTop)*plotH;
 const balanceVals=rows.map(r=>r.projected_ending_balance);
 const lo=Math.min(0,...balanceVals),hi=Math.max(0,...balanceVals);
 const balanceStep=roundStep(Math.max(1,hi-lo)/4),balMin=Math.floor(lo/balanceStep)*balanceStep,balMax=Math.max(balanceStep,Math.ceil(hi/balanceStep)*balanceStep),balRange=balMax-balMin;
 const balanceY=value=>top+(balMax-value)/balRange*plotH;
 const barW=Math.min(19,plotW/count/5);
 const grid=(max,step,y)=><>{Array.from({length:Math.round(max/step)+1},(_,i)=>i*step).map(v=><g key={v}><line x1={left} x2={width-right} y1={y(v)} y2={y(v)} stroke="#dce8e1" strokeDasharray="4 5"/><text x={left-11} y={y(v)+4} fontSize="13" textAnchor="end" fill="#40584b">{brief(v)}</text></g>)}</>;
 const balanceGrid=()=>Array.from({length:Math.round((balMax-balMin)/balanceStep)+1},(_,i)=>balMin+i*balanceStep).map(v=><g key={v}><line x1={left} x2={width-right} y1={balanceY(v)} y2={balanceY(v)} stroke="#dce8e1" strokeDasharray="4 5"/><text x={left-11} y={balanceY(v)+4} fontSize="13" textAnchor="end" fill="#40584b">{brief(v)}</text></g>);
 const focus=(r,series)=>setHover({month:monthLabel(r.month),series,value:series==='Income'?r.predicted_income:series==='Expenses'?r.predicted_expenses:series==='Savings'?r.predicted_savings:r.projected_ending_balance});
 const clear=()=>setHover(null);
 const attrs=(r,series)=>({tabIndex:0,role:'group','aria-label':`${monthLabel(r.month)} ${series}: ${money(series==='Income'?r.predicted_income:series==='Expenses'?r.predicted_expenses:series==='Savings'?r.predicted_savings:r.projected_ending_balance)}`,onFocus:()=>focus(r,series),onBlur:clear,onMouseEnter:()=>focus(r,series),onMouseLeave:clear});
 const labels=rows.map((r,i)=><text key={r.month} x={x(i)} y={height-22} textAnchor="middle" fontSize="13" fontWeight="600" fill="#3d5449">{monthLabel(r.month)}</text>);
 return <section className="forecast-chart-panel" aria-label="Forecast charts and month-by-month table">
  <header className="chart-panel-heading"><div><h3>How your forecast changes each month</h3><p>Cash flow and spendable balance use separate scales to make smaller expenses visible.</p></div></header>
  <div className="chart-section"><h4>Monthly cash flow</h4><p>Compare money coming in, money going out, and money allocated to savings.</p>
   <div className="chart-legend"><span><i className="legend-swatch legend-income"/>↑ Income</span><span><i className="legend-swatch legend-expense"/>↓ Expenses (striped)</span><span><i className="legend-swatch legend-savings"/>▤ Savings (hatched)</span></div>
   <div className="chart-scroller"><svg viewBox={`0 0 ${width} ${height}`} className="chart-svg" role="group" aria-label="Income, expenses, and planned savings per month; use Tab to inspect individual bars">
    <defs><pattern id="buynana-expense-hatch" width="7" height="7" patternUnits="userSpaceOnUse"><rect width="7" height="7" fill="#486579"/><path d="M0 7L7 0" stroke="#d5ecf2" strokeWidth="1.8"/></pattern>
     <pattern id="buynana-savings-hatch" width="7" height="7" patternUnits="userSpaceOnUse"><rect width="7" height="7" fill="#efbb58"/><path d="M0 3.5H7" stroke="#76531b" strokeWidth="1.7"/></pattern></defs>
    {grid(cashTop,cashStep,cashY)}
    {rows.map((r,i)=>{const series=[['Income',r.predicted_income,'#18765a',-barW-4],['Expenses',r.predicted_expenses,'url(#buynana-expense-hatch)',0],['Savings',r.predicted_savings,'url(#buynana-savings-hatch)',barW+4]];
     return <g key={r.month}>{series.map(([name,value,fill,offset])=><rect key={name} x={x(i)+offset-barW/2} y={cashY(value)} width={barW} height={Math.max(0,top+plotH-cashY(value))} rx="3" fill={fill} {...attrs(r,name)}><title>{monthLabel(r.month)} {name}: {money(value)}</title></rect>)}</g>})}
    {labels}
   </svg></div>
  </div>
  <div className="chart-section"><h4>Projected available balance</h4><p>The amount left to spend after expenses and planned savings each month.</p>
   <div className="chart-legend"><span><i className="legend-line"/>◆ Balance (line with diamonds)</span></div>
   <div className="chart-scroller"><svg viewBox={`0 0 ${width} ${height}`} className="chart-svg" role="group" aria-label="Projected ending spendable balance per month; use Tab to inspect individual points">
    {balanceGrid()}
    <line x1={left} x2={width-right} y1={balanceY(0)} y2={balanceY(0)} stroke="#718a78"/>
    <polyline points={rows.map((r,i)=>`${x(i)},${balanceY(r.projected_ending_balance)}`).join(' ')} fill="none" stroke="#066652" strokeWidth="3.5" strokeLinejoin="round" strokeLinecap="round"/>
    {rows.map((r,i)=><g key={r.month}><rect x={x(i)-6} y={balanceY(r.projected_ending_balance)-6} width="12" height="12" transform={`rotate(45 ${x(i)} ${balanceY(r.projected_ending_balance)})`} fill="#066652" stroke="white" strokeWidth="2" {...attrs(r,'Balance')}><title>{monthLabel(r.month)} projected balance {money(r.projected_ending_balance)}</title></rect></g>)}
    {labels}
   </svg></div>
  </div>
  <p className="chart-inspect" role="status" aria-live="polite">{hover?`${hover.month} · ${hover.series}: ${money(hover.value)}`:'Hover over or Tab to a chart bar/diamond for its exact value. The full numbers are in the table below.'}</p>
  <div className="forecast-projection-table"><table><caption>Month-by-month forecast values, in US dollars</caption><thead><tr><th scope="col">Month</th><th scope="col">Income</th><th scope="col">Expenses</th><th scope="col">Planned savings</th><th scope="col">Available balance</th></tr></thead>
   <tbody>{rows.map(r=><tr key={r.month}><th scope="row">{monthLabel(r.month)}</th><td>{money(r.predicted_income)}</td><td>{money(r.predicted_expenses)}</td><td>{money(r.predicted_savings)}</td><td><strong>{money(r.projected_ending_balance)}</strong></td></tr>)}</tbody></table></div>
 </section>;
}
