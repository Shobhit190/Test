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
   - This also creates/populates tabs in your Sheet: Users, Designations,
     Competencies, CompetencyLevels, RoleCompetencyMap, GoalCycles, Goals,
     KRAs, KPIs, CompetencyRatings, ApprovalHistory.
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

There's no separate database to set up — the Sheet you created in step 1
*is* the database, and it's already live once you've deployed. To add
people beyond the 3 demo accounts:

1. In the Apps Script editor, open `Admin.gs`.
2. Find `addEmployeeFromTemplate()` near the bottom and edit the values:
   email, name, a temporary password (tell them what it is), `systemRole`
   (`"EMPLOYEE"`, `"MANAGER"`, or `"HR_ADMIN"`), the designation name
   (must exactly match a row in the Sheet's **Designations** tab, or `""`),
   and their manager's email (must already exist as a user, or `""`).
3. Select `addEmployeeFromTemplate` in the function dropdown and click
   **Run**. Check the *Execution log* for `Added new employee: ...`.
4. Repeat per employee — add managers before the people who report to
   them. Re-running with the same email updates that person (name,
   password, role, designation, manager) instead of creating a duplicate,
   so it's also how you reset someone's password later.
5. If this is your first code change since deploying, create a new
   deployment version (see below) so the live URL picks it up — though
   `Admin.gs` only needs to be *run* from the editor, not deployed, so this
   step is optional unless you've also changed other files.

## Re-seeding

`seedAll()` is safe to re-run at any time, including after you've added
real employees or they've started entering goals. It upserts the reference
data (Competencies, CompetencyLevels, Designations, RoleCompetencyMap, the
`FY2025-26` cycle) by matching on name rather than wiping the tabs, so
existing ids and any data that references them stay valid. It never
touches an existing user (demo or real) or any Goal/KRA/KPI/
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

- **Auth is minimal by design**: SHA-256 password hash (no salt), and the
  "session" is just the logged-in user's row id held in the browser tab's
  memory for the page's lifetime — not a real auth token. Fine for a demo/
  test tool; not something to expose with real employee data as-is.
- **No cycle-switching UI**: like the Next.js version, one active
  `GoalCycle` at a time (seeded as `FY2025-26`).
- **No HR admin screen for editing the dictionary/role mapping** — same as
  the Next.js version, that's managed via `seedAll()` / editing the Sheet
  tabs directly for now.
