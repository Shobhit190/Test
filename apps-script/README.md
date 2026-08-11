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

## Re-seeding

`seedAll()` is safe to re-run — it clears and rewrites the Competencies,
CompetencyLevels, Designations, RoleCompetencyMap, GoalCycles, and Users
tabs, and also clears all Goals/KRAs/KPIs/CompetencyRatings/ApprovalHistory
so you get a clean slate for testing.

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
