/** Optional, explicitly invoked demo seeding; refuses to modify nonempty transaction data. */
const db=require('../database/db');
const existing=db.prepare('SELECT COUNT(*) AS n FROM transactions').get().n;
if(existing>0 || db.prepare('SELECT COUNT(*) AS n FROM budgets').get().n>0 || db.prepare('SELECT COUNT(*) AS n FROM savings_goals').get().n>0){console.log('Demo seed skipped: database contains transactions. No data changed.');process.exit(0);}
const now=new Date();
const years=[now.getFullYear()-2,now.getFullYear()-1];
const insert=db.prepare(`INSERT INTO transactions(description,amount,type,category,transaction_date,is_recurring,recurring_frequency) VALUES(?,?,?,?,?,?,?)`);
const records=[];
for(const year of years){for(let m=1;m<=12;m++)records.push([year,m]);}
for(let m=1;m<=now.getMonth()+1;m++)records.push([now.getFullYear(),m]);
const seed=db.transaction(()=>{
  for(const [year,month] of records){
    const m=String(month).padStart(2,'0');
    const day=n=>`${year}-${m}-${String(n).padStart(2,'0')}`;
    insert.run('Monthly salary',4200,'income','Salary',day(1),1,'monthly');
    insert.run('Rent',950,'expense','Housing',day(3),1,'monthly');
    insert.run('Groceries',month===12?460:320+(month%3)*20,'expense','Food',day(8),0,null);
    insert.run('Transport',140+(month%4)*10,'expense','Transport',day(12),0,null);
    insert.run('Streaming',19.99,'expense','Subscriptions',day(15),1,'monthly');
    if(month===12)insert.run('Holiday gifts',240,'expense','Entertainment',day(18),0,null);
  }
  const next=new Date(now.getFullYear(),now.getMonth()+1,1);
  const nextMonth=`${next.getFullYear()}-${String(next.getMonth()+1).padStart(2,'0')}`;
  for(const [category,amount] of [['Food',400],['Housing',1000],['Transport',200],['Subscriptions',40]])
    db.prepare('INSERT OR IGNORE INTO budgets(category,budget_amount,budget_month) VALUES(?,?,?)').run(category,amount,nextMonth);
  const goal=db.prepare('INSERT INTO savings_goals(goal_name,target_amount,monthly_allocation) VALUES(?,?,?)').run('Emergency Fund',5000,150);
  db.prepare('INSERT INTO savings_contributions(goal_id,amount) VALUES(?,?)').run(goal.lastInsertRowid,650);
});
seed();
console.log('Demo data seeded: two full historical years and recent activity. Use only in a throwaway database.');
db.close();
