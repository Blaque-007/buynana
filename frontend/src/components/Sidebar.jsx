import {NavLink,Link} from 'react-router-dom';
import NavIcon from './NavIcon';
const navigation=[{name:'Dashboard',path:'/',icon:'dashboard'},{name:'Budgets',path:'/budgets',icon:'budgets'},
 {name:'Forecast',path:'/forecast',icon:'forecast'},{name:'History',path:'/history',icon:'history'},
 {name:'Settings',path:'/settings',icon:'settings'}];
export default function Sidebar({onAddTransaction}) {
 return <aside className="sidebar" aria-label="Main navigation">
  <Link className="sidebar-brand" to="/" aria-label="BuyNana home"><span className="brand-icon" aria-hidden="true">🍌</span><h2>BuyNana</h2></Link>
  <div><p className="sidebar-caption">Workspace</p><nav className="sidebar-navigation" aria-label="Pages">
   {navigation.map(item=><NavLink key={item.path} to={item.path} end={item.path==='/'} className={({isActive})=>`navigation-link ${isActive?'active':''}`}>
    <NavIcon name={item.icon}/><span>{item.name}</span></NavLink>)}
  </nav></div>
  <button type="button" className="sidebar-action" onClick={onAddTransaction}>＋ Add transaction</button>
  <div className="sidebar-footer"><strong>Local demo</strong>Financial tracking & forecasting<br/>Your records stay on this computer.</div>
 </aside>;
}
