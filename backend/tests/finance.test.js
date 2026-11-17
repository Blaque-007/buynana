const test = require('node:test');
const assert = require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const tempDir=fs.mkdtempSync(path.join(os.tmpdir(),'buynana-test-'));
process.env.BUYNANA_DB_PATH=path.join(tempDir,'data.db');
const db=require('../database/db');
const app=require('../server');
const f=require('../services/forecastService');
const money=v=>Math.round(v*100)/100;
const now=new Date();
const currentMonth=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
const lastMonth=(()=>{const d=new Date(now.getFullYear(),now.getMonth()-1,1);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;})();
const nextMonth=(()=>{const d=new Date(now.getFullYear(),now.getMonth()+1,1);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;})();
const today=`${currentMonth}-${String(now.getDate()).padStart(2,'0')}`;
const fakeFuture=`${nextMonth}-05`;
let server,base;
async function json(url,method='GET',body){const r=await fetch(base+url,{method,headers:body?{'content-type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json()};}
test.before(async()=>{server=await new Promise(ok=>{const s=app.listen(0,'127.0.0.1',()=>ok(s));});base='http://127.0.0.1:'+server.address().port;});
test.after(async()=>{await new Promise(ok=>server.close(ok));db.close();fs.rmSync(tempDir,{recursive:true,force:true});});
test('health and empty forecast fallback',async()=>{
  assert.equal((await json('/api/health')).status,200);
  const noData=await json('/api/forecast/hybrid','POST',{expectedIncome:3000,expectedExpenses:1500,months:3});
  assert.equal(noData.status,200);
  assert.equal(noData.data.data.monthly_projection.length,3);
  assert.equal(noData.data.data.monthly_projection[2].projected_ending_balance,4500);
});
test('budget suggestions require explicit confirmation',async()=>{
  await json('/api/budgets','POST',{category:'Food',budget_amount:500,budget_month:nextMonth});
  const noConfirm=await json('/api/forecast/hybrid','POST',{expectedIncome:3000});
  assert.equal(noConfirm.data.data.requires_expense_confirmation,true);
  assert.equal(noConfirm.data.data.projected_ending_balance,null);
  const yesConfirm=await json('/api/forecast/hybrid','POST',{expectedIncome:3000,confirmBudget:true});
  assert.equal(yesConfirm.data.data.predicted_expenses,500);
  assert.equal(yesConfirm.data.data.projected_ending_balance,2500);
  assert.equal((await json('/api/forecast/hybrid','POST',{expectedIncome:-3})).status,400);
});
test('transaction create, edit, validation, and budget CRUD',async()=>{
  const created=await json('/api/transactions','POST',{description:'Paycheck',amount:3000,type:'income',category:'Salary',transaction_date:today,is_recurring:0});
  assert.equal(created.status,201);const id=created.data.transaction_id;
  assert.equal((await json('/api/transactions','POST',{description:'Bad date',amount:1,type:'expense',category:'Other',transaction_date:'2026-02-30'})).status,400);
  assert.equal((await json(`/api/transactions/${id}`,'PUT',{description:'Salary',amount:3000,type:'income',category:'Salary',transaction_date:today,is_recurring:0})).status,200);
  assert.equal((await json(`/api/transactions/${id}`,'PUT',{description:'Invalid',amount:-3,type:'income',category:'Salary',transaction_date:today})).status,400);
  const budgets=await json(`/api/budgets?month=${nextMonth}`);const budget=budgets.data[0];
  assert.equal((await json(`/api/budgets/${budget.budget_id}`,'PUT',{category:'Food',budget_amount:600,budget_month:nextMonth})).status,200);
  assert.equal((await json(`/api/budgets/${budget.budget_id}`,'DELETE')).status,200);
});
test('future-dated expenses remain scheduled and do not count as budget spent', async () => {
  const budget=(await json('/api/budgets','POST',{category:'Subscriptions',budget_amount:100,budget_month:nextMonth})).data;
  const scheduled=(await json('/api/transactions','POST',{description:'Renewal',amount:65,type:'expense',category:'Subscriptions',transaction_date:fakeFuture})).data;
  assert.equal((await json(`/api/budgets?month=${nextMonth}`)).data.find(b=>b.budget_id===budget.budget_id).spent,0);
  await json(`/api/transactions/${scheduled.transaction_id}`,'DELETE');
  await json(`/api/budgets/${budget.budget_id}`,'DELETE');
});
test('savings plans are capped by target and keep savings separate from expenses',async()=>{
  const goal=await json('/api/savings/goals','POST',{goal_name:'Emergency',target_amount:250,monthly_allocation:100});
  assert.equal(goal.status,201);
  const id=goal.data.goal_id;
  const contribution=await json(`/api/savings/goals/${id}/contributions`,'POST',{amount:50});
  assert.equal(contribution.status,201);
  assert.equal(f.getAvailableBalance(),2950);
  const forecast=await json('/api/forecast/hybrid','POST',{expectedIncome:1000,expectedExpenses:300,months:3});
  assert.equal(forecast.status,200);
  const rows=forecast.data.data.monthly_projection;
  assert.deepEqual(rows.map(r=>r.predicted_savings),[100,100,0]);
  assert.equal(rows[2].projected_ending_balance,4850);
  await json(`/api/savings/goals/${id}`,'DELETE');
  assert.equal(f.getAvailableBalance(),2950);
});
test('future transactions do not inflate today’s available balance',async()=>{
  const future=await json('/api/transactions','POST',{description:'Future paycheck',amount:1200,type:'income',category:'Salary',transaction_date:fakeFuture});
  assert.equal(future.status,201);
  assert.equal(f.getAvailableBalance(),2950);
  await json(`/api/transactions/${future.data.transaction_id}`,'DELETE');
});
test('historical recurring and nonrecurring expenses are combined once',async()=>{
  db.prepare('INSERT INTO transactions(description,amount,type,category,transaction_date,is_recurring,recurring_frequency) VALUES(?,?,?,?,?,?,?)').run('Rent',800,'expense','Housing',`${lastMonth}-01`,1,'monthly');
  db.prepare('INSERT INTO transactions(description,amount,type,category,transaction_date,is_recurring,recurring_frequency) VALUES(?,?,?,?,?,?,?)').run('Groceries',200,'expense','Food',`${lastMonth}-10`,0,null);
  db.prepare('INSERT INTO transactions(description,amount,type,category,transaction_date,is_recurring,recurring_frequency) VALUES(?,?,?,?,?,?,?)').run('Income',3200,'income','Salary',`${lastMonth}-02`,0,null);
  const expenses=f.calculateCombinedExpenseForecast();
  assert.equal(expenses.predicted_total_expenses,1000);
  const auto=f.calculateHybridForecast({months:1});
  assert.equal(auto.requires_user_input,false);
  assert.equal(auto.predicted_expenses,1000);
  assert.equal(auto.predicted_recurring_expenses,800);
  assert.equal(auto.predicted_nonrecurring_expenses,200);
});

test('recurring due dates handle annual and month-end schedules', () => {
  assert.equal(f.recurrenceDueAmount({transaction_date:'2025-12-10',amount:120,recurring_frequency:'yearly'},'2026-12'),120);
  assert.equal(f.recurrenceDueAmount({transaction_date:'2025-12-10',amount:120,recurring_frequency:'yearly'},'2026-11'),0);
  assert.equal(f.recurrenceDueAmount({transaction_date:'2026-01-31',amount:40,recurring_frequency:'monthly'},'2026-02'),40);
});
test('database export includes all financial tables', async () => {
  const backup=await json('/api/export');
  assert.equal(backup.status,200);
  assert.ok(Array.isArray(backup.data.transactions));
  assert.ok(Array.isArray(backup.data.budgets));
  assert.ok(Array.isArray(backup.data.savings_goals));
  assert.ok(Array.isArray(backup.data.savings_contributions));
});
