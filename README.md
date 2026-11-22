# Smart Roster Management System

A practical browser-based roster management tool built for the DataStraw internship assessment.

## What is included

- 30 employees across 6 operational pods
- 12 brands and multiple processes (CS, ACC, NDR, Retention)
- Single-resource and multi-resource brands
- Configurable brand operating calendars
- Weekly-off and planned-leave handling
- Public holiday handling
- Monthly roster generation
- Coverage validation and conflict detection
- Company-wide roster view
- Employee, assignment and rules views
- Add/remove resource assignments without changing code
- CSV export
- SQLite persistence

## Tech stack

- Node.js + Express
- SQLite via better-sqlite3
- HTML, CSS and vanilla JavaScript

The application intentionally uses a simple stack so the scheduling logic is easy to understand and explain during an interview.

## Run locally

Requirements: Node.js 18+.

```bash
npm install
npm start
```

Open:

`http://localhost:3000`

The SQLite database is created automatically as `roster.db` on first run and sample data is seeded automatically.

## Scheduling approach

The generator is deterministic and works as a constraint-validation pass:

1. Load employees, assignments, process requirements, leaves and holidays.
2. Create every date in the selected month.
3. Mark each employee as WORK/OFF based on weekly off, approved leave and holiday rules.
4. For every brand/process/day that requires service, count assigned employees who are available.
5. Compare available resources with the process minimum staffing requirement.
6. Create a CRITICAL conflict if required coverage is not satisfied.
7. Flag employees shared across multiple brands as WARNING items for capacity review.

This approach prioritises reliable visibility of conflicts instead of silently creating an invalid roster.

## Single-resource vs multi-resource brands

Most seeded brands have one dedicated employee. Four brands have three employees. When multiple employees are assigned to a brand, assignments can be split by process. The data model does not hard-code the number of employees, so the manager can add or remove assignments from the UI.

## If a single-resource employee becomes unavailable

The generator does not automatically hide the problem. The assigned employee becomes unavailable for that day, and the affected process is checked again. If no backup resource remains, the application reports a CRITICAL Coverage Gap with the required and available staffing count.

## Mandatory constraints vs preferences

Coverage requirements are treated as mandatory. Weekly-off preferences are represented as employee schedule rules. When a conflict cannot be satisfied, the application surfaces it for the operations manager instead of pretending it is resolved.

## Human control vs automation

The system automates date generation, availability checks, coverage calculation and conflict detection. The manager retains control over assignments, leave input and the final resolution of conflicts because operational decisions may require business context.

## Scaling

For a larger team, I would move roster generation into a dedicated scheduling service, add database indexes around employee/date/assignment queries, and introduce an optimisation layer for fairness and preferences. The UI would remain largely unchanged because the core entities are already normalised.

## Demo flow

1. Open Dashboard.
2. Generate the current month's roster.
3. Open Coverage & Conflicts.
4. Open Assignments and remove a resource from a multi-resource brand.
5. Generate the roster again and observe the changed coverage/conflict result.
6. Add the resource back and revalidate.
7. Export the roster as CSV.

## Assumptions

- A process with `min_staff = 1` needs at least one assigned available employee on every operating day.
- `365` means Sundays and public holidays are operational.
- `DAILY` means daily operation except configured public holidays.
- `SUN_OFF` means Sundays and public holidays are off.
- Same-day shared-brand assignments are allowed in the data model but flagged for manager review because exact shift/capacity rules can vary by client.

## Suggested assessment talking points

- The key problem is coverage, not calendar rendering.
- The data model separates brand calendars from employee schedules.
- Conflicts are first-class outputs of the generator.
- The solution can handle changes without rebuilding the application's underlying code.
