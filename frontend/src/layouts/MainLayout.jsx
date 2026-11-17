import {Outlet} from 'react-router-dom';
import {useState} from 'react';
import Sidebar from '../components/Sidebar';
import TransactionModal from '../components/TransactionModal';
export default function MainLayout(){
 const [adding,setAdding]=useState(false);
 const updated=()=>window.dispatchEvent(new Event('buynana:transactions-changed'));
 return <div className="app-layout">
  <a className="skip-link" href="#main-content">Skip to main content</a>
  <Sidebar onAddTransaction={()=>setAdding(true)}/>
  <main className="main-workspace" id="main-content"><Outlet/></main>
  <TransactionModal isOpen={adding} onClose={()=>setAdding(false)} onTransactionAdded={updated}/>
 </div>;
}
