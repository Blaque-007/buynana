# UI verification — 2026-11-17

| Check | Result |
|---|---|
| `npm test` (backend; Node.js 22 built-in SQLite) | PASS — 10/10 |
| `npm run test:ui` (frontend source structure) | PASS — 5/5 |
| `tsc --allowJs --checkJs false --jsx react-jsx --noEmit --skipLibCheck --target ES2022 --module ESNext --moduleResolution bundler --lib ES2022,DOM src/App.jsx src/components/*.jsx src/pages/*.jsx src/layouts/*.jsx` | PASS — source parsed |
| CSS syntax parsing (`tinycss2`) | PASS — 9/9 stylesheet files |
| Representative palette AA ratios | PASS — 6.22:1–12.51:1 for sampled foreground/background pairs |
| Full Vite build | NOT VERIFIED HERE — Windows native frontend dependencies and no npm network access on this Linux runtime |
| Automated browser interaction / screenshot audit | NOT VERIFIED HERE — requires the Windows target after `npm ci` |

This is a source-level and backend-level verification, **not** a claim that every interaction was tested in a live browser. The project should be launched and visually checked at desktop and narrow-window widths on Windows before presentation.

## Windows steps

1. `setup-windows.cmd`
2. `run-windows.cmd`
3. In a fresh PowerShell terminal: `cd frontend; npm.cmd run build; npm.cmd run test:ui`
4. In backend: `npm.cmd test`
5. Browser checks: navigation / sidebar quick-add / Dashboard budget empty state / History filtering and delete confirmation / Forecast Generate + chart + stale state / Savings Goals / Settings text-size & export.
