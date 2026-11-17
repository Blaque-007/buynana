import {useEffect,useRef} from 'react';
export default function ConfirmDialog({open,title,children,onConfirm,onCancel,busy=false,confirmLabel='Delete'}){
 const ref=useRef(null);
 useEffect(()=>{const el=ref.current;if(!el)return;if(open&&!el.open)el.showModal();if(!open&&el.open)el.close();},[open]);
 return <dialog ref={ref} className="confirm-dialog" aria-labelledby="confirm-title" onCancel={e=>{if(busy)e.preventDefault();else onCancel();}}>
  <h2 id="confirm-title">{title}</h2><div className="confirm-dialog__body">{children}</div>
  <div className="confirm-dialog__actions"><button type="button" className="btn btn--ghost" disabled={busy} onClick={onCancel}>Cancel</button>
   <button type="button" className="btn btn--danger" disabled={busy} onClick={onConfirm}>{busy?'Deleting…':confirmLabel}</button></div>
 </dialog>;
}
