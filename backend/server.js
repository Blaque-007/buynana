/** BuyNana single-user LOCAL DEMO server. Do not expose to the internet: no authentication. */
const express = require('express');
const cors = require('cors');
const db = require('./database/db');
const savingsRoutes = require('./routes/savingsRoutes');
const forecastRoutes = require('./routes/forecastRoutes');
const app = express();
const port = Number(process.env.PORT || 3001);
const money = v => Math.round((v + Number.EPSILON) * 100) / 100;
const validAmount = v => typeof v === 'number' && Number.isFinite(v) && v > 0 && Math.round(v*100)/100 === v;
const validMonth = m => typeof m==='string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(m);
const positiveId = value => Number.isSafeInteger(Number(value)) && Number(value)>0;
const today = () => {const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
function validDate(d) {return typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&!Number.isNaN(Date.parse(`${d}T00:00:00Z`))&&new Date(`${d}T00:00:00Z`).toISOString().slice(0,10)===d;}
const bad = (res,error) => res.status(400).json({error});
function validateTransaction(input) {
  const {description,amount,type,category,transaction_date,is_recurring=0,recurring_frequency=null}=input;
  if(typeof description!=='string'||!description.trim()||description.length>200)return 'Description must be 1–200 characters.';
  if(!validAmount(amount))return 'Amount must be a positive number with at most two decimal places.';
  if(!['income','expense'].includes(type))return 'Type must be income or expense.';
  if(typeof category!=='string'||!category.trim()||category.length>80)return 'Category must be 1–80 characters.';
  if(transaction_date!==undefined&&!validDate(transaction_date))return 'Transaction date must be a real YYYY-MM-DD date.';
  if(![0,1].includes(is_recurring))return 'Recurring flag must be 0 or 1.';
  if(is_recurring===1&&!['weekly','monthly','yearly'].includes(recurring_frequency))return 'Choose weekly, monthly, or yearly frequency.';
  return null;
}
app.use(cors({origin:['http://localhost:5173','http://127.0.0.1:5173']}));
app.use(express.json({limit:'100kb'}));
app.get('/api/health',(_req,res)=>res.json({status:'success',message:'BuyNana backend is running!',database:'connected'}));
app.use('/api/savings',savingsRoutes);
app.use('/api/forecast',forecastRoutes);

app.get('/api/transactions',(_req,res)=>{
  try {res.json(db.prepare(`SELECT * FROM transactions ORDER BY transaction_date DESC,transaction_id DESC`).all());}
  catch(e){console.error(e);res.status(500).json({error:'Unable to retrieve transactions'});}
});
app.post('/api/transactions',(req,res)=>{
  try {
    const input=req.body||{};
    const error=validateTransaction(input);if(error)return bad(res,error);
    const recurring=input.is_recurring??0;
    const result=db.prepare(`INSERT INTO transactions(description,amount,type,category,transaction_date,is_recurring,recurring_frequency)
      VALUES(?,?,?,?,?,?,?)`).run(input.description.trim(),input.amount,input.type,input.category.trim(),input.transaction_date??today(),recurring,
        recurring?input.recurring_frequency:null);
    res.status(201).json(db.prepare('SELECT * FROM transactions WHERE transaction_id=?').get(result.lastInsertRowid));
  } catch(e){console.error(e);res.status(500).json({error:'Unable to create transaction'});}
});
app.put('/api/transactions/:id',(req,res)=>{
  try{
    if(!positiveId(req.params.id))return bad(res,'Invalid transaction ID');
    const input=req.body||{};
    const error=validateTransaction(input);if(error)return bad(res,error);
    const recurring=input.is_recurring??0;
    const result=db.prepare(`UPDATE transactions SET description=?,amount=?,type=?,category=?,transaction_date=?,is_recurring=?,recurring_frequency=?
      WHERE transaction_id=?`).run(input.description.trim(),input.amount,input.type,input.category.trim(),input.transaction_date??today(),recurring,
      recurring?input.recurring_frequency:null,Number(req.params.id));
    if(!result.changes)return res.status(404).json({error:'Transaction not found'});
    res.json(db.prepare('SELECT * FROM transactions WHERE transaction_id=?').get(Number(req.params.id)));
  }catch(e){console.error(e);res.status(500).json({error:'Unable to edit transaction'});}
});
app.delete('/api/transactions/:id',(req,res)=>{
  try{
    if(!positiveId(req.params.id))return bad(res,'Invalid transaction ID');
    const result=db.prepare('DELETE FROM transactions WHERE transaction_id=?').run(Number(req.params.id));
    if(!result.changes)return res.status(404).json({error:'Transaction not found'});
    res.json({message:'Transaction deleted',transaction_id:Number(req.params.id)});
  }catch(e){console.error(e);res.status(500).json({error:'Unable to delete transaction'});}
});
app.get('/api/budgets',(req,res)=>{
  try {
    if(!validMonth(req.query.month))return bad(res,'A valid month is required (YYYY-MM)');
    const rows=db.prepare(`SELECT b.budget_id,b.category,b.budget_amount,b.budget_month,
      COALESCE(SUM(t.amount),0) AS spent FROM budgets b LEFT JOIN transactions t
      ON LOWER(t.category)=LOWER(b.category) AND t.type='expense' AND substr(t.transaction_date,1,7)=b.budget_month
      AND t.transaction_date<=?
      WHERE b.budget_month=? GROUP BY b.budget_id ORDER BY b.category`).all(today(),req.query.month);
    res.json(rows.map(r=>({...r,spent:money(r.spent),remaining:money(r.budget_amount-r.spent),percentage_used:Math.round(r.spent/r.budget_amount*100)})));
  }catch(e){console.error(e);res.status(500).json({error:'Unable to retrieve budgets'});}
});
function validateBudget(input){
  if(typeof input.category!=='string'||!input.category.trim()||input.category.length>80)return 'A category is required (max 80 characters).';
  if(!validAmount(input.budget_amount))return 'Budget must be a positive amount with at most two decimal places.';
  if(!validMonth(input.budget_month))return 'Budget month must use YYYY-MM.';
  return null;
}
app.post('/api/budgets',(req,res)=>{
  try{
    const input=req.body||{};const error=validateBudget(input);if(error)return bad(res,error);
    const exists=db.prepare('SELECT budget_id FROM budgets WHERE LOWER(category)=LOWER(?) AND budget_month=?').get(input.category.trim(),input.budget_month);
    if(exists)return res.status(409).json({error:'This category already has a budget for that month.'});
    const result=db.prepare('INSERT INTO budgets(category,budget_amount,budget_month) VALUES(?,?,?)').run(input.category.trim(),input.budget_amount,input.budget_month);
    res.status(201).json(db.prepare('SELECT * FROM budgets WHERE budget_id=?').get(result.lastInsertRowid));
  }catch(e){console.error(e);res.status(500).json({error:'Unable to create budget'});}
});
app.put('/api/budgets/:id',(req,res)=>{
  try{
    if(!positiveId(req.params.id))return bad(res,'Invalid budget ID');
    const input=req.body||{};const error=validateBudget(input);if(error)return bad(res,error);
    const existing=db.prepare('SELECT budget_id FROM budgets WHERE LOWER(category)=LOWER(?) AND budget_month=? AND budget_id<>?')
      .get(input.category.trim(),input.budget_month,Number(req.params.id));
    if(existing)return res.status(409).json({error:'This category already has a budget for that month.'});
    const result=db.prepare('UPDATE budgets SET category=?,budget_amount=?,budget_month=? WHERE budget_id=?')
      .run(input.category.trim(),input.budget_amount,input.budget_month,Number(req.params.id));
    if(!result.changes)return res.status(404).json({error:'Budget not found'});
    res.json(db.prepare('SELECT * FROM budgets WHERE budget_id=?').get(Number(req.params.id)));
  }catch(e){console.error(e);res.status(500).json({error:'Unable to update budget'});}
});
app.delete('/api/budgets/:id',(req,res)=>{
  try{
    if(!positiveId(req.params.id))return bad(res,'Invalid budget ID');
    const result=db.prepare('DELETE FROM budgets WHERE budget_id=?').run(Number(req.params.id));
    if(!result.changes)return res.status(404).json({error:'Budget not found'});
    res.json({message:'Budget deleted'});
  }catch(e){console.error(e);res.status(500).json({error:'Unable to delete budget'});}
});
app.get('/api/export',(_req,res)=>{
  try{
    const dataset={exported_at:new Date().toISOString(),disclaimer:'BuyNana local demo backup',
      transactions:db.prepare('SELECT * FROM transactions ORDER BY transaction_id').all(),
      budgets:db.prepare('SELECT * FROM budgets ORDER BY budget_id').all(),
      savings_goals:db.prepare('SELECT * FROM savings_goals ORDER BY goal_id').all(),
      savings_contributions:db.prepare('SELECT * FROM savings_contributions ORDER BY contribution_id').all()};
    res.set('Content-Disposition','attachment; filename="buynana-backup.json"');res.json(dataset);
  }catch(e){console.error(e);res.status(500).json({error:'Unable to export data'});}
});
app.use('/api',(req,res)=>res.status(404).json({error:'Unknown API endpoint'}));
app.use((err,req,res,next)=>{
  if(err instanceof SyntaxError&&'body' in err)return res.status(400).json({error:'Malformed JSON body'});
  console.error(err);return res.status(500).json({error:'Unexpected server error'});
});
if(require.main===module) app.listen(port,'127.0.0.1',()=>console.log(`BuyNana API running at http://localhost:${port}`));
module.exports=app;
