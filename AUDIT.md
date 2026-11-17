# BuyNana source audit and repair notes

Audit basis: uploaded `buynana.zip` source tree (React/Vite frontend, Express API, SQLite schema and example DB). This is a targeted code audit and a set of executable regression tests, **not** a production security audit or proof that every possible bug is absent.

## Confirmed issues corrected

| Severity | Issue in uploaded project | Correction |
| --- | --- | --- |
| Critical | Windows installation failed while compiling native `better-sqlite3` with `node-gyp`; later `nodemon` missing because npm install had failed | Migrated SQLite connection to built-in `node:sqlite` on Node >=22.12 using `--experimental-sqlite`, removed native add-on and nodemon from dependencies, regenerated backend lockfile, added Windows setup/run `.cmd` scripts |
| High | `Dashboard.jsx` referenced undefined `results` in `refreshDashboard()` after successful saves | Uses `Promise.allSettled()` results consistently and displays refresh errors without raising a ReferenceError |
| High | Forecast starting balance included future-dated transactions | The balance calculation now excludes future-dated transactions and savings contributions |
| High | Forecast API accepted a budget-only estimate without evidence that it covered all expense categories | API now requires `confirmBudget: true` unless a manual total expense input is supplied; React has explicit confirmation checkbox |
| High | Forecast assumed today's balance was the opening balance for next month with little explanation | Forecast explicitly reports a scenario using today's recorded balance; UI and documentation explain the omitted remaining-current-month period |
| High | Existing forecasts did not project future savings and savings goals had no plan field | Added `monthly_allocation` migration and Goal Form field; forecast applies monthly goal plans and caps at remaining goal targets |
| High | Incomplete/new-user forecasting had no multi-month result with charts | Added hybrid 1/3/6/12-month projection arrays, forecast SVG chart, results table, source explanations and warning for negative balances |
| Medium | Forecast only used recurring monthly equivalents, including annual bills every month | Automatic historical expense scenarios now estimate recurring payment dates for weekly/monthly/yearly transactions rather than spreading annual bills across every month |
| Medium | API needed consistent transaction/goal/budget input validation | Stronger validation, safer missing-body handling, cents precision and clearer errors |
| Medium | Transaction/Budget records could not be edited or budgets deleted from UI | Added PUT routes for transactions and budgets, DELETE budgets route, History edit action, Budget actions |
| Medium | Frontend services used hard-coded cross-origin localhost URLs | Changed to relative `/api` paths with a Vite development proxy |
| Medium | Settings page was a placeholder | Added local backend-status check and JSON export |
| Medium | ZIP contained `.git` internals and platform-specific `node_modules` | Delivered package omits Git internals, dependency folders and build outputs; preserves separate database copy |
| Medium | Temporary legacy transaction-test and database inspection files were part of delivered app | Removed unused debug entry and obsolete inspection utilities |
| Medium | Test coverage was minimal and seasonal test required the native SQLite package | Added `node:test` integration tests and moved the seasonal test to built-in SQLite |

## Verification performed

- SQLite integrity check of the supplied database returned `ok`; original table data was preserved in the working copy during migration.
- Backend API was started from the repaired code and health/forecast endpoints responded correctly.
- `node --experimental-sqlite --test` passed **9/9** tests.
- JavaScript/JSX frontend sources were parsed with the TypeScript parser: **21 files, 0 syntax errors** before final documentation changes.
- **Frontend build not fully executed in this Linux environment**: uploaded `node_modules` contained Windows-only Rolldown native binaries, and package retrieval was unavailable. On Windows, `npm.cmd ci` should install the correct binaries. Run `npm.cmd run build` and verify the browser end-to-end there.

## Remaining prototype limitations / follow-up production work

1. **No authentication or user-specific accounts.** Keep server bound to localhost. Do not deploy publicly as-is.
2. **Recurring identification heuristic:** payments with same normalized description and category are treated as one schedule. Distinct identical names can be merged, renamed subscriptions can be counted separately. Dedicated recurring schedule IDs and active/cancelled status are future enhancements.
3. **Starting-balance timing:** future full-month projections do not include actual/projected remaining activity in the current month. The UI clearly discloses this assumption.
4. **Historical data completeness is inferred**, not confirmed. One recorded transaction in a month does not prove the month is complete. Two full calendar years of activity are required before seasonal factors activate.
5. **Financial arithmetic uses SQLite REAL / JavaScript numbers.** Money is rounded on outputs, but rigorous production accounting should migrate to integer cents or decimal arithmetic and journal-based account balances.
6. **No automatic bank imports, user login, actual bank reconciliations, or cloud hosting.** Not required for professor demonstration.
7. **No automatic future transactions** are written for forecast-only recurring commitments or planned savings. This is intentional to avoid overstating actual cash flow.
8. **No automatic restore** from JSON exports. A full offline database backup and restore procedure is described in README.
9. **UI is based on the existing screenshot/design direction**, not a verified pixel-perfect copy of the current Figma file.
10. **No end-to-end browser run on the user's Windows computer from this environment.** Run the setup scripts, `npm.cmd test`, `npm.cmd run build`, and the demonstration walkthrough there.

## Suggested professor demo order

Dashboard → Add transaction → History edit/filter → Budgets create/edit → Forecast input + 3-month chart → Savings Goal planned allocation → Generate forecast again → Settings export.

The new source does not modify the user's GitHub remote; commit it to a new branch after reviewing on their local computer.
