# BuyNana — financial tracker and forecasting (professor demo)

BuyNana is a **single-user, local development prototype** built with React, Vite, Express and SQLite. It demonstrates a working frontend, backend, persistent database, transaction history, budgets, savings goals, and month-by-month cash-flow forecasting. **Not a bank application, not a deployed financial product.**

## System requirements

- Windows 10/11 or macOS/Linux (instructions below are for Windows)
- **Node.js 22.12 or newer** (`node -v`) and npm
- Internet access **once** to install npm dependencies
- VS Code optional (any editor works)
- **No Python or Visual Studio C++ Build Tools required:** SQLite uses Node's built-in `node:sqlite`, launched with `--experimental-sqlite` on Node 22. The experimental warning is normal.

## First-time setup on Windows

1. Extract this ZIP into a local folder, ideally `C:\Projects\BuyNana` instead of OneDrive (OneDrive can lock SQLite/npm files).
2. Double-click `setup-windows.cmd`, or open PowerShell in the extracted root and run:

   ```powershell
   cd .\backend
   npm.cmd ci
   cd ..\frontend
   npm.cmd ci
   ```

3. Double-click `run-windows.cmd`, or start these **in separate PowerShell terminals** from the root:

   ```powershell
   cd .\backend
   npm.cmd run dev
   ```

   ```powershell
   cd .\frontend
   npm.cmd run dev
   ```

4. Open <http://127.0.0.1:5173> in your browser. The backend API uses port **3001** and Vite proxies `/api` requests to it. Health check: <http://127.0.0.1:3001/api/health>.

Use `npm.cmd` if PowerShell blocks `npm.ps1`. If either port is occupied, stop the other process using it. Leave both terminals open while using BuyNana.

## Existing data and privacy

This delivered ZIP includes a **copy of the SQLite database in the uploaded ZIP** at `backend/database/buynana.db`, with existing records retained. It may not match what was on a different computer. Do not push `.db` files to GitHub. Keep the project and exported backups private.

Use Settings → **Export financial data** to download a JSON snapshot. A JSON export is a backup for inspection, not an automated restore feature. To back up/restore the complete live database instead, stop the backend first and copy `backend/database/buynana.db` (and keep it private).

The database schema is created/migrated automatically. The change adds `monthly_allocation` to savings goals without deleting existing records.

## Optional presentation dataset (never seeds over existing records)

For a **separate demo database**, open a new PowerShell terminal in `backend` and run:

```powershell
$env:BUYNANA_DB_PATH = "$PWD\database\presentation-demo.db"
npm.cmd run seed:demo
npm.cmd run dev
```

The seed command refuses to write if this database already has transactions, budgets, or goals. It creates two complete historical years and recent transactions so neutral versus seasonal predictions can be demonstrated. **Keep the backend in the same terminal** with `BUYNANA_DB_PATH` set. Your regular `buynana.db` remains unchanged. To return to it, stop the server and run `Remove-Item Env:\BUYNANA_DB_PATH`, then restart.

## UI/UX improvements in this edition

The refreshed interface restores a persistent left sidebar, consistent 1180px content width, accessible navigation and control styling, and a clear global Add transaction button. Dashboard cards now have consistent sizes and explain why an unbudgeted expense is not shown in budget progress. History includes month/year filters, future-date badges, and a delete confirmation dialog. Forecast has separate cash-flow and available-balance charts, complete month labels, manual/automatic assumption switches, and clear stale-result and budget-confirmation states. Settings supports locally saved text size and contrast preferences and reports export status.

See **UI_UX_FIXES.md** for the detailed issue-by-issue disposition, including intentional limitations.

For an additional UI structure smoke test on any computer with Node.js:

```powershell
cd .\frontend
npm.cmd run test:ui
```

For the full frontend build check (after dependency installation):

```powershell
npm.cmd run build
```

## What to demonstrate

1. **Dashboard:** Available balance, income, estimated recurring expenses, monthly savings rate, budget overview and recent transactions. Add a transaction and watch totals refresh.
2. **History:** Search/filter transactions, edit dates and recurring frequency, delete test entries.
3. **Budgets:** Create a category limit, observe spent/remaining from the SQLite transaction table, edit or delete the limit.
4. **Forecast:** Review suggested financial values; confirm that any budget-based expense suggestion is complete or enter total expected expenses; optionally override income and savings; choose a 1/3/6/12-month horizon; generate cash-flow chart, projected balances and category seasonal factors.
5. **Savings Goals:** Create/edit goals with planned monthly allocations, make a real contribution, see progress, then archive a demo goal (archival retains financial history).
6. **Settings:** Check backend status and export financial records to JSON.

## Forecast model and limitations

The forecast starts from **today's recorded available balance** (income minus expenses minus saved contributions, excluding future-dated transactions). It projects subsequent **full calendar months**; it does **not** estimate remaining cash flow between today and the start of next month. This is a **scenario forecast**, not an exact date-specific month-end prediction.

- Income: historical average across completed months with recorded activity; if missing, a tagged recurring-income suggestion or manual input.
- Nonrecurring expenses: category averages across completed activity months, adjusted by category-specific calendar-month factors only after two full years of history. Otherwise the factor is 1.
- Recurring expenses: weekly/monthly/yearly projections based on the most recent tagged transaction and its date; recurring descriptions/categories are a heuristic for identifying schedules.
- Manual expense overrides and confirmed budgets: treated as **total expected expenses**, including recurring bills, so they are not added twice.
- Savings: active goals' monthly plans reduce forecast available balance; goal allocations stop when the remaining target is reached. Manual savings can override plans for the scenario. No real money moves until users explicitly record a contribution.
- All forecast results are estimates. The model assumes months with activity are sufficiently representative; data completeness is not verified. Forecasts do not measure risk with a statistical confidence interval.

## Code and tests

```powershell
cd .\backend
npm.cmd test
```

Backend test coverage includes HTTP API routes, input validation, budget confirmation, savings balances and limits, future dates, recurring vs nonrecurring expenses, and seasonal factors. Frontend syntax checks were performed, but the full frontend build needs npm dependencies installed on the target platform.

Structure:

```text
BuyNana/
  backend/database/db.js
  backend/services/forecastService.js
  backend/services/seasonalService.js
  backend/routes/forecastRoutes.js
  backend/routes/savingsRoutes.js
  backend/tests/
  frontend/src/pages/{Dashboard,History,Budgets,Forecast,Settings}.jsx
  frontend/src/components/{SavingsGoals,ForecastChart,...}.jsx
  frontend/src/services/
  setup-windows.cmd
  run-windows.cmd
```

## Security boundary

The backend binds to **127.0.0.1 only** and has **no authentication**. This is deliberately a professor demo, not a hosted web app. Do not expose port 3001 to a public network or use it for real private financial accounts. Future production development would need user accounts, authentication, encryption/privacy controls, robust ledger accounting, recurring schedule IDs, and verified month completeness.

See [AUDIT.md](AUDIT.md) for specific issues addressed and remaining limitations.
