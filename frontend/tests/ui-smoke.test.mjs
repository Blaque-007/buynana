import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const file=(path)=>readFileSync(new URL('../src/'+path,import.meta.url),'utf8');
test('application imports shared layout styles and skip link',()=>{
 assert.match(file('App.jsx'),/import\s+["']\.\/App\.css["']/);
 assert.match(file('layouts/MainLayout.jsx'),/className="skip-link"/);
 assert.match(file('layouts/MainLayout.jsx'),/Sidebar onAddTransaction/);
});
test('all five destinations retain route definitions',()=>{
 const app=file('App.jsx');
 for(const path of ['\/budgets','\/forecast','\/history','\/settings']) assert.ok(app.includes(path));
});
test('transactions use category choices appropriate to income or expense',()=>{
 const modal=file('components/TransactionModal.jsx');
 assert.match(modal,/categoriesByType\[formData\.type\]/);
 assert.match(modal,/Salary/);
 assert.match(modal,/transaction_date > getTodayDate\(\)/);
});
test('forecast includes differentiated charts, readable dates and accessible table',()=>{
 const chart=file('components/ForecastChart.jsx');
 assert.match(chart,/Monthly cash flow/);
 assert.match(chart,/Projected available balance/);
 assert.match(chart,/role="status"/);
 assert.match(chart,/monthLabel\(r\.month\)/);
 assert.match(chart,/tabIndex:0/);
});
test('settings offer saved text size and high-contrast mode',()=>{
 const settings=file('pages/Settings.jsx');
 assert.match(settings,/buynana:text-size/);
 assert.match(settings,/Higher contrast/);
 assert.match(settings,/Export data \(JSON\)/);
});
