import {useEffect,useState} from 'react';
import './Settings.css';
function initialPreference(name,defaultValue){try{return localStorage.getItem(`buynana:${name}`)||defaultValue}catch{return defaultValue}}
export default function Settings(){
 const [status,setStatus]=useState('Checking connection…');
 const [message,setMessage]=useState(''),[exporting,setExporting]=useState(false);
 const [textSize,setTextSize]=useState(()=>initialPreference('text-size','normal'));
 const [contrast,setContrast]=useState(()=>initialPreference('contrast','standard'));
 useEffect(()=>{document.documentElement.dataset.textSize=textSize;document.documentElement.dataset.contrast=contrast;
  try{localStorage.setItem('buynana:text-size',textSize);localStorage.setItem('buynana:contrast',contrast);}catch{/* private browsing */}
 },[textSize,contrast]);
 useEffect(()=>{let active=true;fetch('/api/health').then(r=>{if(!r.ok)throw Error('Offline');return r.json();}).then(()=>{if(active)setStatus('Connected');}).catch(()=>{if(active)setStatus('Disconnected');});return()=>{active=false;};},[]);
 async function exportData(){setMessage('');setExporting(true);try{
  const response=await fetch('/api/export');if(!response.ok)throw new Error('Could not export data. Check the backend connection.');
  const blob=await response.blob();const day=new Date().toISOString().slice(0,10),name=`buynana-backup-${day}.json`;
  const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=name;document.body.appendChild(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);setMessage(`Your backup was prepared as ${name} (JSON format). Check your Downloads folder.`);
 }catch(e){setMessage(e.message);}finally{setExporting(false);}}
 return <div className="settings-page">
  <header className="page-header"><div><h1>Settings</h1><p className="page-subtitle">Make BuyNana easier to use and keep a copy of your data.</p></div></header>
  <section className="settings-card card" aria-labelledby="accessibility-title"><h2 id="accessibility-title">Accessibility</h2><p className="muted">Customize readability on this computer. Controls also use icons and text, not color alone.</p>
   <div className="settings-grid"><div className="settings-field"><label htmlFor="text-size">Text size</label><select id="text-size" value={textSize} onChange={e=>setTextSize(e.target.value)}><option value="normal">Standard</option><option value="large">Large</option></select><small>Changes text size throughout BuyNana.</small></div>
    <div className="settings-field"><label htmlFor="contrast">Contrast mode</label><select id="contrast" value={contrast} onChange={e=>setContrast(e.target.value)}><option value="standard">Standard (color-blind-friendly)</option><option value="high">Higher contrast</option></select><small>Higher contrast strengthens borders and text contrast.</small></div></div>
   <p className="settings-preference-note" role="status">Preferences are automatically saved in this browser. Currency is USD in this local prototype.</p>
  </section>
  <section className="settings-card card" aria-labelledby="backup-title"><h2 id="backup-title">Export your financial data</h2>
   <p className="muted">Download your transactions, budgets, savings goals, and contributions as a JSON file. Keep it private because it contains financial information.</p>
   <div className="settings-actions"><button type="button" className="btn btn--primary" onClick={exportData} disabled={exporting}>{exporting?'Preparing export…':'↓ Export data (JSON)'}</button><span className="muted">A backup copy, not an automatic restore.</span></div>
   {message&&<p className={`notice ${message.startsWith('Could not')?'notice--error':'notice--success'}`} role="status">{message}</p>}
  </section>
  <section className="settings-card card"><h2>About this demo</h2><p className="muted">BuyNana runs locally as a single-user class project. Current connection: <strong className={status==='Connected'?'settings-online':'settings-offline'}>{status}</strong>.</p>
   <details><summary>Developer information</summary><p>Frontend: React and Vite · Backend: Express · Storage: local SQLite file.</p><p>For an isolated presentation dataset, use the documented `seed:demo` command in a separate database. Resetting the current dataset is intentionally not available in the interface to prevent accidental loss of records.</p><p>This prototype does not provide account authentication or cloud synchronization.</p></details>
  </section>
 </div>;
}
