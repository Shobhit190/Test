# Goal Setting — Google Apps Script version

Same app as the Next.js version (KRA/KPI goal entry with weight validation,
role-competency self-rating with live level indicators, manager
Submit → Approve/Return → Resubmit workflow, dashboards), rebuilt to run
entirely inside Google Sheets + Apps Script. No installs, no database to
stand up — deploy straight from your browser.

Data lives in a Google Sheet (one tab per table); the UI is served by
Apps Script's `HtmlService`.

## Deploy (about 5 minutes)

1. **Create a new Google Sheet.** Go to [sheets.google.com](https://sheets.google.com) → Blank spreadsheet.
2. **Open the script editor.** Extensions → Apps Script.
3. **Create the files.** This project has 8 script files (`.gs`) and 3 HTML
   files. In the Apps Script editor:
   - Delete the default empty `Code.gs` content (you'll paste real content into it next).
   - For each file below, use the `+` next to "Files" → **Script** (for `.gs`) or **HTML** (for `.html`),
     name it exactly as shown (no extension needed when naming — Apps Script adds it), and paste in the matching file's contents from this folder:
     - `Schema.gs`
     - `Db.gs`
     - `Domain.gs`
     - `Auth.gs`
     - `Repository.gs`
     - `SeedData.gs` *(large — it's the embedded competency dictionary + role mapping)*
     - `Seed.gs`
     - `Code.gs`
     - `Admin.gs`
     - `Index.html`
     - `Stylesheet.html`
     - `Javascript.html`
4. **Seed the data.** In the Apps Script editor toolbar, select the function
   dropdown (next to the Debug button), choose `seedAll`, and click **Run**.
   - The first run will prompt you to authorize the script (it needs
     permission to edit the Sheet it's bound to) — click through the
     "Google hasn't verified this app" warning (Advanced → Go to project (unsafe));
     this is normal for a script you wrote/pasted yourself.
   - Check the *Execution log* for `Seed complete: 19 competencies, 40 designations.`
   - This also creates/populates tabs in your Sheet: Employee Details,
     Designations, Competencies, CompetencyLevels, RoleCompetencyMap,
     GoalCycles, Goals, KRAs, KPIs, CompetencyRatings, ApprovalHistory.
   - **If you get "No spreadsheet found"**: your script isn't bound to a
     Sheet — this happens if you created the project at script.google.com
     directly instead of via a Sheet's Extensions menu. Fix it without
     starting over: open `Db.gs`, find `setupFromSheetUrl()` near the top,
     replace `"PASTE_YOUR_GOOGLE_SHEET_URL_HERE"` with your actual Sheet's
     URL (copy it from the browser address bar), select `setupFromSheetUrl`
     in the function dropdown, click **Run** once, then run `seedAll` as normal.
5. **Deploy as a web app.** Deploy → New deployment → gear icon → **Web app**.
   - Execute as: **Me**
   - Who has access: **Anyone** (or **Anyone within [your org]** if you're on Workspace and want it restricted)
   - Click **Deploy**, authorize again if prompted, then copy the web app URL.
6. **Open the URL.** You'll see the login screen.

Demo accounts (password `password123` for all — seeded by `seedAll`):

| Email | Role |
|---|---|
| `employee@example.com` | Employee (Business Analyst) |
| `manager@example.com` | Manager |
| `hr.admin@example.com` | HR Admin |

## Adding real employees

There's no separate database to set up — the **Employee Details** tab
created by `seedAll()` *is* the employee database, and it's already live
once you've deployed. You can add people two ways:

**Option A — edit the sheet directly.** Open the **Employee Details** tab
and add one row per person, in this exact column order:

| Column | Meaning |
|---|---|
| Employee Code | Unique per person — this is their row's internal id, so it must not repeat or be blank. |
| Name | Full name. Also what **Manager** below is matched against for other employees. |
| Brand | Free text (e.g. which brand/business unit they sit under). |
| Designation | Must exactly match a name in the **Designations** tab, or leave blank. |
| Manager | Must exactly match another employee's **Name** in this same sheet, or leave blank. Add managers before the people who report to them. |
| Role | `EMPLOYEE`, `MANAGER`, or `HR_ADMIN`. |
| PMS Cycle | Informational — everyone shares the one active cycle (`FY2025-26` by default) regardless of what's typed here. |
| Email | Their login email. Must be unique. |
| Password | Their login password — stored and compared as **plain text** (see note below), typically set to the same value as Employee Code. |

Typos in Designation or Manager fail silently (that person just won't get
role-specific competency options, or their goal won't route to the right
approver) — there's no validation on a hand-typed row.

**Option B — run a script.** In the Apps Script editor, open `Admin.gs`,
edit the values in `addEmployeeFromTemplate()` near the bottom (same
fields as above, in function-argument form), select it in the function
dropdown, and click **Run**. This validates Designation and Manager
against what's actually in the sheet before saving, so a typo throws an
error immediately instead of silently breaking that person's competency
options or approvals later. Check the *Execution log* for
`Added new employee: ...`.

Either way, re-running with the same Employee Code updates that person
(name, password, role, designation, manager, etc.) instead of creating a
duplicate row — that's also how you reset someone's password later.

**On passwords**: they're stored as plain text, not hashed. Given the
password is typically just the Employee Code — already visible in the
next cell over — hashing it would only add friction, not real security.
This tool was already documented as not production-grade auth (see
Notes/limitations below); treat the Sheet itself as the sensitive asset
and control who has access to it.

## What employees see after logging in

Right after signing in, employees see a one-time **guidelines** screen
(edit the `GUIDELINES` array near the top of `Javascript.html` to change
the text) before landing on the dashboard. The dashboard also shows a
**My Details** card with their Employee Code, Brand, Designation, Manager,
PMS Cycle, and Role — everything from their Employee Details row except
Email and Password.

## Re-seeding

`seedAll()` is safe to re-run at any time, including after you've added
real employees or they've started entering goals. It upserts the reference
data (Competencies, CompetencyLevels, Designations, RoleCompetencyMap, the
`FY2025-26` cycle) by matching on name rather than wiping the tabs, so
existing ids and any data that references them stay valid. It never
touches an existing employee (demo or real) or any Goal/KRA/KPI/
CompetencyRatings/ApprovalHistory data — only inserts the 3 demo accounts
if they're missing. Use it to pick up changes to the competency dictionary
or role mapping without disturbing anyone's real data.

If you deliberately want to wipe all goal data and start a cycle over,
select `clearGoalData_` in the function dropdown and run it manually —
`seedAll()` never calls it automatically.

## Updating the code after editing a deployment

If you change any file's content in the editor, existing web app URLs keep
serving the **old** code until you create a new deployment version:
Deploy → Manage deployments → pick the deployment → Edit (pencil icon) →
Version: **New version** → Deploy.

## Regenerating SeedData.gs

`SeedData.gs` is generated from `prisma/seed-data/competency-dictionary.json`
and `prisma/seed-data/role-competency-map.json` (the same source files the
Next.js version seeds from). If those change, regenerate with:

```bash
python3 -c "
import json
with open('../prisma/seed-data/competency-dictionary.json') as f: d = json.load(f)
with open('../prisma/seed-data/role-competency-map.json') as f: r = json.load(f)
out = '/** Embedded reference data (generated). Do not hand-edit. */\n\n'
out += 'var COMPETENCY_DICTIONARY = ' + json.dumps(d, ensure_ascii=False) + ';\n\n'
out += 'var ROLE_COMPETENCY_MAP = ' + json.dumps(r, ensure_ascii=False) + ';\n'
open('SeedData.gs', 'w').write(out)
"
```

## Notes / limitations vs. the Next.js version

- **Auth is minimal by design**: passwords are stored as plain text (see
  "On passwords" above), and the "session" is just the logged-in user's
  row id held in the browser tab's memory for the page's lifetime — not a
  real auth token. Fine for a demo/test tool; not something to expose
  with real employee data as-is.
- **No cycle-switching UI**: like the Next.js version, one active
  `GoalCycle` at a time (seeded as `FY2025-26`).
- **No HR admin screen for editing the dictionary/role mapping** — same as
  the Next.js version, that's managed via `seedAll()` / editing the Sheet
  tabs directly for now.
