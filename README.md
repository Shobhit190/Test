# Employee Goal-Setting App

A Next.js app implementing the goal-setting workflow: employees set weighted
KRAs (90%) and self-rate role competencies (10%), submit for manager
approval, and can be sent back for revision before final approval.

## Stack

- Next.js 16 (App Router) + TypeScript + Tailwind CSS
- PostgreSQL + Prisma 7 (driver adapter: `@prisma/adapter-pg`)
- Auth.js (NextAuth v5) with email/password credentials, JWT sessions

## Data model highlights

- `Competency` / `CompetencyLevel` / `Designation` / `RoleCompetencyMap` are
  seeded from the two reference files supplied for this project:
  - `Competency_Dictionary_24_Mar_26.docx` — 19 named competencies (3 also
    flagged `isCore`, org-wide) across 3 clusters / 6 sub-clusters, each with
    a definition and 5 levels (A–E) of behaviour indicators.
  - `Competency_Mapping_for_Founders_4.xlsx` — the role → required-competency
    mapping for 40 designations, closing the "role mapping doesn't exist
    yet" gap called out in the original spec.
  - The extraction scripts (`prisma/seed-data/extract_docx.py`,
    `extract_xlsx.py`) regenerate the JSON fixtures from the source files if
    the dictionary or mapping ever changes.
- `Goal` → `KRA` → `KPI`, plus `CompetencyRating` and `ApprovalHistory`
  implement the Draft → Submitted → Approved/Returned workflow.

## Local setup

```bash
# 1. Postgres must be running and reachable at the DATABASE_URL in .env
createuser goalapp --createdb   # or adjust .env to an existing role
createdb -O goalapp goalapp

# 2. Install deps
npm install

# 3. Apply schema + seed reference data and demo users
npx prisma migrate dev
npx tsx prisma/seed.ts

# 4. Run
npm run dev
```

Demo accounts (password for all: `password123`):

| Email | Role |
|---|---|
| `employee@example.com` | Employee (Business Analyst) |
| `manager@example.com` | Manager (Priya Nair's manager) |
| `hr.admin@example.com` | HR Admin (org-wide view) |

## What's implemented

- Employee goal form: dynamic KRA/KPI rows, live weight-sum validation
  (2–6 KRAs summing to 100%, ≤3 KPIs per KRA), competency self-rating
  (dropdown scoped to the employee's designation + core competencies,
  1–10 slider with live level name and behaviour-indicator text).
- Submit → manager Approve / Return-with-comments → employee edits and
  resubmits, with a full approval-history audit trail per goal.
- Dashboard: employee's own goal status; manager's team rollup; HR's
  org-wide rollup.

## Open items carried over from the spec

- **Revision cycle cap**: none enforced — returns can loop indefinitely.
- **Cycle cadence / historical versioning**: one active `GoalCycle` at a
  time (`FY2025-26` seeded); goals are unique per employee+cycle, so a new
  cycle naturally starts fresh goals, but there's no cycle-switch UI yet.
- **HR/Admin competency-dictionary management UI**: the data model and seed
  pipeline exist; there's no in-app CRUD screen yet for editing the
  dictionary or role mapping (done via the seed scripts / DB for now).
