# Elevate Goal Setting Portal — Google Apps Script version

KRA/KPI goal entry with weight validation, manager Submit → Approve/Return →
Resubmit workflow, dashboards, and a separate promotion-readiness
self-assessment (rate yourself against your next career-ladder level's
competencies, with live level indicators) — all running entirely inside
Google Sheets + Apps Script. No installs, no database to stand up — deploy
straight from your browser.

Data lives in a Google Sheet (one tab per table); the UI is served by
Apps Script's `HtmlService`.

## Deploy (about 5 minutes)

1. **Create a new Google Sheet.** Go to [sheets.google.com](https://sheets.google.com) → Blank spreadsheet.
2. **Open the script editor.** Extensions → Apps Script.
3. **Create the files.** This project has 10 script files (`.gs`) and 3 HTML
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
     - `PromotionData.gs` *(the promotion-ladder competency mapping)*
     - `Seed.gs`
     - `Code.gs`
     - `Admin.gs`
     - `Report.gs` *(the HR "Report" tab generator)*
     - `Index.html`
     - `Stylesheet.html`
     - `Javascript.html`
4. **Seed the data.** In the Apps Script editor toolbar, select the function
   dropdown (next to the Debug button), choose `seedAll`, and click **Run**.
   - The first run will prompt you to authorize the script (it needs
     permission to edit the Sheet it's bound to) — click through the
     "Google hasn't verified this app" warning (Advanced → Go to project (unsafe));
     this is normal for a script you wrote/pasted yourself.
   - Check the *Execution log* for `Seed complete: 19 competencies, 40 designations, 11 promotion levels.`
   - This also creates/populates tabs in your Sheet: Employee Details,
     Designations, Competencies, CompetencyLevels, RoleCompetencyMap,
     PromotionLevels, PromotionCompetencyMap, PromotionRatings, GoalCycles,
     Goals, KRAs, KPIs, ApprovalHistory.
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

Demo accounts (password `password123` for all — seeded by `seedAll`). The
login screen itself no longer lists these — it just tells people to sign in
with their work email and their Employee Code as the password, since that's
what real employees will actually do (see "Adding real employees" below):

| Email | Role | Business Role |
|---|---|---|
| `employee@example.com` | Employee (Business Analyst) | Associate |
| `manager@example.com` | Manager | Manager |
| `hr.admin@example.com` | HR Admin | — |

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
| Brand | Free text (e.g. which brand/business unit they sit under). Shown in the UI as **Entity**. |
| Designation | Must exactly match a name in the **Designations** tab, or leave blank. Purely informational — shown on the profile, no longer drives anything functional. |
| Business Role | Their level on the promotion ladder — must exactly match a name in the **PromotionLevels** tab (e.g. `Associate`, `Manager`, `Senior Vice President`). Usually leave this **blank**: for Full-Time staff, Designation already *is* a ladder level name, so it resolves automatically with no manual entry. Only fill this in when Designation uses a different job title than the ladder (or leave both blank for Faculty, not on this ladder yet). |
| Manager | Must exactly match another employee's **Name** in this same sheet, or leave blank. Add managers before the people who report to them. Shown in the UI as **Reporting Manager**. |
| Role | `EMPLOYEE`, `MANAGER`, or `HR_ADMIN` — controls app permissions (who can see the approval queue, etc). Not shown on the employee's own profile, just used internally. |
| Goal Cycle | Informational label for which round of goal-setting this is. |
| Assessment Period | Informational label for which performance/promotion assessment period this is. No longer shown on the employee's My Details card, but still used in the Report tab. |
| Email | Their login email. Must be unique. |
| Password | Their login password — stored and compared as **plain text** (see note below), typically set to the same value as Employee Code. |

Typos in Designation, Business Role, or Manager fail silently (that person
just won't see the relevant My Development-screen competencies, or their
goal won't route to the right approver) — there's no validation on a
hand-typed row.

**Option B — run a script.** In the Apps Script editor, open `Admin.gs`,
edit the values in `addEmployeeFromTemplate()` near the bottom (same
fields as above, in function-argument form), select it in the function
dropdown, and click **Run**. This validates Designation and Manager
against what's actually in the sheet before saving, so a typo throws an
error immediately instead of silently breaking that person's approvals
later. (Business Role isn't validated here since it doesn't apply to
everyone yet — e.g. Faculty.) Check the *Execution log* for
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

## Branding

The Elevate Education logo is embedded directly in `Javascript.html` as a
base64 `LOGO_BASE64` constant (no external image hosting needed) — it shows
on the login screen and in the top nav bar on every authenticated screen.
To swap it for a new logo, replace that constant's value with a new
base64-encoded PNG.

## What employees see after logging in

Right after signing in, employees see a one-time **guidelines** screen
(edit the `GUIDELINES` array near the top of `Javascript.html` to change
the text) before landing on the **Employee Dashboard**. The dashboard also
shows a **My Details** card with their Employee Code, Entity (the Brand
column), Designation, and Reporting Manager. Goal Cycle and Assessment
Period aren't shown here. Business Role isn't shown here either (it's
usually just a duplicate of Designation now that it auto-resolves — see
below) but still drives what they see on the My Development tab; the
internal permissions Role and their Email/Password aren't shown either.
For managers/HR, the dashboard's team rollup shows their **entire
downline** (direct and indirect reports), though who can actually
approve/return a goal is still limited to that person's direct manager —
see `getApprovalQueue` in `Code.gs`.

## Role Readiness (the "My Development" tab)

Separate from goal-setting, every employee has a **My Development** screen
(titled "Role Readiness") where they self-rate against the competencies
expected at their *next* level on the Full-Time promotion ladder (their own
level's competencies, if they're already at the top). This isn't scored as
part of the goal — KRAs are the whole goal now — but it's tracked as a
standing development record (`PromotionRatings`), independent of any goal
cycle, so it survives `clearGoalData_()` and re-seeding.

The screen also shows an **Expected Average Rating badge** at the top (e.g.
"Expected Average Rating: 4–5/10"), pulled from the target level's
`maturityMin`/`maturityMax` in the PromotionLevels tab — generic, with no
role name attached, so a Senior Associate sees Assistant Manager's expected
average without it being spelled out.

**A goal can't be submitted until every competency on this screen has been
rated at least once** (see `validatePromotionRatingsComplete_()` in
`Repository.gs`) — but only when there's actually something to rate: an
employee whose Business Role/Designation doesn't resolve to a ladder level
(blank, a typo, or intentionally out of scope like Faculty) has no
competencies to rate, so their submission isn't blocked by a screen they
have nothing to fill in.

**The guided flow — one submit, for both:** the My Goals screen only has a
"Next: Rate competencies →" button, no Submit button of its own. Once your
KRAs are filled in, Next takes you to the My Development tab, which has the
*only* "Submit for approval" button — it saves and submits the KRAs and the
competency ratings together as one package (as long as your goal was loaded
this session and is still editable).

**Ratings lock with the goal.** Once submitted, both the KRAs and the
competency ratings become read-only (sliders disabled, no Save/Submit
buttons) until a manager decides. A manager's **Approve** locks them for
the rest of the cycle; a **Return** unlocks both again for editing and
resubmission — `savePromotionRatings` is gated on the same goal-status
check as `saveGoalDraft` (`getOrCreateGoal_` → `DRAFT`/`RETURNED`), so
there's no separate lock state to keep in sync.

**Managers review both together.** The existing Approval Detail screen
(Approvals → click an employee) now has a **Role Readiness** section right
below the KRAs, showing the same competency cards the employee sees
(rating, level name, behaviour indicators, self-assessment comments) —
read-only, no separate screen. It's populated by
`getPromotionReadinessSnapshot_()` in `Repository.gs`, added to the
`getApprovalDetail` payload. Since that RPC is only ever reached for a
goal that's already Submitted or later (via the approval queue), a
manager never sees an employee's still-drafting ratings. Approve/Return
still uses the one existing comment field — there's no separate
competency-specific comment.

**Business Role auto-resolves from Designation.** For Full-Time staff,
Designation already *is* a ladder level name (e.g. `Senior Associate`), so
it's picked up with zero manual data entry. Business Role only needs
filling in by hand when Designation doesn't match the ladder wording.

The ladder itself (`PromotionLevels`/`PromotionCompetencyMap` tabs) is
hand-transcribed from a "Promotion Architecture" proposal deck — 11
Full-Time levels (Associate → ... → Senior Vice President), each with 4-5
promotion-critical competencies and a target maturity band. That deck
marks the mapping as **proposed, pending validation** — if it changes,
edit those two tabs directly (same hand-editable pattern as
Designations/RoleCompetencyMap); `seedAll()` only upserts by name, so it
won't overwrite your edits. **Faculty is intentionally out of scope for
now** — it's a separate qualification-gated track in the source deck, not
a competency ladder, so Faculty employees should just leave Business Role
and Designation blank (or use a Designation that doesn't match a ladder
name) until that's designed.

## HR report (the "Report" tab)

HR Admins get a **Report** nav link with a single "Generate / refresh
report" button. Clicking it (or running `generateReport()` from the Apps
Script editor) writes one row per employee to a **Report** tab: Employee
Code, Name, Brand, Designation, Business Role, Reporting Manager, Goal
Cycle, Assessment Period, Goal Status, KRA Count, Total KRA Weightage,
Current Level, Target Level, Competencies Required, Competencies Rated,
Avg Self-Rating, and when ratings were last updated — everything in one
place instead of opening each person's screen individually.

Unlike the hand-editable reference tabs, **Report is pure output**: every
run fully clears and rewrites it, so don't hand-edit it — your changes
would just be overwritten next time someone regenerates it.

## Re-seeding

`seedAll()` is safe to re-run at any time, including after you've added
real employees or they've started entering goals. It upserts the reference
data (Competencies, CompetencyLevels, Designations, RoleCompetencyMap,
PromotionLevels, PromotionCompetencyMap, the `FY2025-26` cycle) by matching
on name rather than wiping the tabs, so existing ids and any data that
references them stay valid. It never touches an existing employee (demo or
real) or any Goal/KRA/KPI/ApprovalHistory/PromotionRatings data — only
inserts the 3 demo accounts if they're missing. Use it to pick up changes
to the competency dictionary or promotion mapping without disturbing
anyone's real data.

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
