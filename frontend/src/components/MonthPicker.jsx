import {localMonth} from '../utils/format';
const months=['January','February','March','April','May','June','July','August','September','October','November','December'];
export default function MonthPicker({value,onChange,id='month',allowAll=false}) {
 const currentYear=Number(localMonth().slice(0,4));
 const chosenYear=value?Number(value.slice(0,4)):currentYear;
 const years=Array.from(new Set([...Array.from({length:13},(_,i)=>currentYear-7+i),chosenYear])).sort((a,b)=>b-a);
 const changeYear = year => onChange(`${year}-${value ? value.slice(5,7) : localMonth().slice(5,7)}`);
 const changeMonth = month => onChange(`${value ? value.slice(0,4):currentYear}-${month}`);
 return <div className="month-picker" role="group" aria-label="Choose month and year">
  <label htmlFor={`${id}-month`} className="sr-only">Month</label>
  <select id={`${id}-month`} value={value?value.slice(5,7):''} onChange={e=>changeMonth(e.target.value)}>
   {allowAll&&<option value="">All months</option>}
   {!value && !allowAll && <option value="" disabled>Select month</option>}
   {months.map((month,i)=><option key={month} value={String(i+1).padStart(2,'0')}>{month}</option>)}
  </select>
  <label htmlFor={`${id}-year`} className="sr-only">Year</label>
  <select id={`${id}-year`} value={chosenYear} onChange={e=>changeYear(e.target.value)} disabled={allowAll&&!value}>
   {years.map(year=><option key={year} value={year}>{year}</option>)}
  </select>
 </div>;
}
