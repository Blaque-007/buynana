export const money = value => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(value)||0);
export const monthLabel = value => {
 if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value||'')) return value || 'Unknown month';
 const [year,month]=value.split('-').map(Number);
 return new Intl.DateTimeFormat('en-US',{month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(Date.UTC(year,month-1,1)));
};
export const longDate = value => {
 if (!/^\d{4}-\d{2}-\d{2}$/.test(value||'')) return value||'Unknown date';
 const [year,month,day]=value.split('-').map(Number);
 return new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'}).format(new Date(Date.UTC(year,month-1,day)));
};
export const localToday = () => {const now=new Date();return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;};
export const localMonth = () => localToday().slice(0,7);
