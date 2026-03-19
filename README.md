# TISE — Task Intelligence Scheduling Engine

TISE is an intelligent task scheduling application that predicts the consequences of adding tasks to your schedule before you commit. It combines a **consequence engine**, **time banking**, and **automatic rebalancing** to help you maintain a realistic schedule — and recover gracefully when things slip.

## Why TISE?

Most task managers let you pile on work without warning. TISE flips this: when you add a task, it tells you *exactly* what will happen to your existing schedule — which tasks will slip, how much buffer you'll consume, and whether you're heading toward overload. You decide with full visibility.

## Key Features

### Consequence Engine
Before committing a new task, TISE calculates:
- **Adjusted Effort** — estimated time adjusted by task complexity and your personal velocity
- **Impact Analysis** — which existing tasks stay on time and which will slip (and by how many days)
- **Deep Work Protection** — flags when deep work blocks are at risk
- **Suggested Dates** — proposes the earliest feasible deadline if yours is too tight
- **Overload Warnings** — alerts when 3+ consecutive days exceed capacity

### Personal Execution Velocity (PEV)
TISE learns how you estimate vs. how long tasks actually take. After enough data (10 tasks, 8 sessions, 2+ days), it calibrates all future scheduling to your real pace. No more optimistic planning.

### Time Bank
- **Earn credits** by finishing tasks early (up to 15 min per task)
- **Spend credits** when tasks overrun, absorbing the impact without disrupting your schedule
- When the bank runs dry mid-overrun, slip detection kicks in

### Slip Detection & Rebalancing
A 3-level recovery system:
| Level | Trigger | Strategy |
|-------|---------|----------|
| 1 | Minor slip | Time Bank absorbs it — no moves needed |
| 2 | Moderate slip | Reorder today's remaining tasks |
| 3 | Major slip | Repack schedule across the next 14 days |

Rebalancing respects constraints: pinned tasks don't move, near-term blocks (next 12 hours) are locked, and at most 30% of blocks (or 3 tasks) are relocated.

### Invisible Capacity Buffer
Your declared availability is multiplied by 0.75 internally. This 25% hidden buffer accounts for meetings, interruptions, and context switching — so your schedule stays realistic without you having to think about it.

### System Calibration Modes
TISE adapts over time through four modes:

`warm_start` → `calibration` → `personalized` → `autopilot`

As you log more sessions, the system transitions from defaults to fully personalized scheduling.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | [Next.js 16](https://nextjs.org/) (App Router) |
| Language | TypeScript 5.9 |
| UI | React 19, TailwindCSS 4 |
| Database | [Supabase](https://supabase.com/) (PostgreSQL + Auth + RLS) |
| Server State | [TanStack React Query 5](https://tanstack.com/query) |
| Monorepo | [Turborepo](https://turbo.build/) with npm workspaces |
| Core Logic | Pure TypeScript library (`@repo/core`) — zero external dependencies |

## Project Structure

```
tise/
├── apps/
│   └── web/                          # Next.js application
│       ├── app/
│       │   ├── (app)/dashboard/      # Main dashboard (protected)
│       │   ├── (app)/onboarding/     # Capacity profile setup
│       │   ├── (auth)/login/         # Authentication
│       │   └── api/
│       │       ├── tasks/            # CRUD for tasks
│       │       ├── consequence/      # Impact prediction
│       │       ├── rebalance/        # Slip recovery
│       │       └── time-sessions/    # Work session logging
│       ├── components/               # UI components
│       └── lib/supabase.ts           # DB client setup
├── packages/
│   ├── core/                         # Scheduling algorithms (pure TS)
│   │   ├── consequence-engine.ts     # Impact prediction logic
│   │   ├── rebalancer.ts            # Multi-level rebalancing
│   │   ├── pev.ts                   # Personal Execution Velocity
│   │   ├── time-bank.ts            # Deposit/withdraw logic
│   │   └── types.ts                 # Domain types & constants
│   ├── ui/                           # Shared React components
│   ├── eslint-config/                # ESLint presets
│   └── typescript-config/            # Shared tsconfig
└── supabase/
    └── schema.sql                    # Full database schema (7 tables + RLS)
```

## Database Schema

| Table | Purpose |
|-------|---------|
| `capacity_profiles` | User availability settings and system mode |
| `tasks` | Task definitions with type, effort, deadline, status |
| `schedule_blocks` | Time slots assigned to tasks |
| `day_capacities` | Daily capacity tracking (declared vs effective) |
| `time_bank` | Daily earned/spent buffer minutes |
| `time_sessions` | Actual work logged (estimated vs actual) |
| `rebalance_plans` | Generated recovery plans with move history |

All tables use Row Level Security — each user can only access their own data.

## Getting Started

### Prerequisites

- Node.js >= 18
- npm 10+
- A [Supabase](https://supabase.com/) project

### Setup

1. **Clone the repository**
   ```sh
   git clone https://github.com/<your-username>/tise.git
   cd tise
   ```

2. **Install dependencies**
   ```sh
   npm install
   ```

3. **Configure environment variables**

   Create `apps/web/.env.local`:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   ```

4. **Set up the database**

   Run the SQL in `supabase/schema.sql` against your Supabase project (via the SQL Editor in the Supabase dashboard or the CLI).

5. **Start the development server**
   ```sh
   npm run dev
   ```

   The app runs at [http://localhost:3000](http://localhost:3000).

### Other Commands

```sh
npm run build         # Build all apps and packages
npm run lint          # Lint all code
npm run format        # Format with Prettier
npm run check-types   # Type-check all packages
```

## How It Works

```
User adds task → Consequence Engine computes impact
                        ↓
        Shows: slipping tasks, buffer cost, suggested date
                        ↓
        User commits (accept / adjust / mark flexible)
                        ↓
                Task created + scheduled
                        ↓
        User logs work session → Time Bank updated
                        ↓
        Overrun detected? → Slip score calculated
                        ↓
        Level 1: Bank absorbs | Level 2: Day reorder | Level 3: 14-day repack
                        ↓
        User reviews & accepts rebalance plan
```

## API Routes

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/tasks` | Fetch user's tasks with schedule blocks |
| `POST` | `/api/tasks` | Create a new task |
| `POST` | `/api/consequence` | Compute impact of a potential task |
| `POST` | `/api/rebalance` | Generate a rebalance plan from slip data |
| `PATCH` | `/api/rebalance` | Accept and apply a rebalance plan |
| `POST` | `/api/time-sessions` | Log actual work time for a task |

## License

MIT
