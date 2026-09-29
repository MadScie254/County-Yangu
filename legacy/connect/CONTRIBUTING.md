# Contributing to CountyConnect

Thank you for your interest in contributing to CountyConnect — a white-label civic

operations platform for Kenya's 47 county governments.

This document covers everything you need to get started.

---

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [Development Workflow](#development-workflow)
- [Branching Strategy](#branching-strategy)
- [Commit Convention](#commit-convention)
- [Pull / Merge Request Guidelines](#pull--merge-request-guidelines)
- [Supabase & Environment Setup](#supabase--environment-setup)
- [Code Style](#code-style)
- [Testing](#testing)
- [Reporting Bugs](#reporting-bugs)
- [Requesting Features](#requesting-features)

---

## Code of Conduct

All contributors are expected to be respectful, constructive, and inclusive.
Harassment or discrimination of any kind will not be tolerated.

---

## Getting Started

### Prerequisites

| Tool | Minimum version |
|---|---|
| Node.js | 20.x |
| npm | 10.x |
| Supabase CLI | Latest |
| Git | 2.x |

### Local Setup

```bash
# 1. Clone the repository
git clone https://gitlab.com/MadScie254/County-Connect.git
cd County-Connect

# 2. Install dependencies
npm install

# 3. Copy the example env file
cp .env.example .env.local

# 4. Fill in your Supabase project URL and anon key in .env.local

# 5. Apply database migrations
supabase db push

# 6. Start the dev server
npm run dev
```

The app runs at `http://localhost:3000`.

---

## Project Structure

src/

├── components/     # Shared UI components (layout, modals, banners)

├── context/        # React context providers (Auth, Toast)

├── hooks/          # Custom hooks (useSupabase)

├── lib/            # Business logic, mutations, types, helpers

├── pages/          # Route-level page components

│   ├── admin/      # Admin-only pages

│   └── auth/       # Login and Register pages

supabase/

├── functions/      # Deno Edge Functions (M-Pesa, USSD)

└── migrations/     # Ordered SQL migrations
---

## Development Workflow

1. Pick an open issue or create one before starting work.
2. Create a branch from `main` using the naming convention below.
3. Make focused, well-scoped changes.
4. Run `npm run lint` (TypeScript check) before pushing.
5. Open a Merge Request targeting `main`.

---

## Branching Strategy

| Prefix | Purpose | Example |
|---|---|---|
| `feat/` | New feature | `feat/ussd-gateway-activation` |
| `fix/` | Bug fix | `fix/mpesa-callback-parsing` |
| `chore/` | Tooling, deps, config | `chore/update-supabase-sdk` |
| `docs/` | Documentation only | `docs/api-hub-readme` |
| `refactor/` | Code restructure, no behaviour change | `refactor/store-hooks` |
| `hotfix/` | Critical production fix | `hotfix/rls-policy-bypass` |

---

## Commit Convention

This project follows [Conventional Commits](https://www.conventionalcommits.org/).
<type>(optional scope): <short description>
[optional body]
[optional footer]
### Types

| Type | When to use |
|---|---|
| `feat` | A new feature |
| `fix` | A bug fix |
| `docs` | Documentation changes |
| `style` | Formatting, whitespace (no logic change) |
| `refactor` | Code change that is neither a fix nor a feature |
| `perf` | Performance improvement |
| `test` | Adding or updating tests |
| `chore` | Build process, dependency updates |
| `revert` | Reverting a previous commit |

### Examples
feat(mpesa): add webhook reconciliation for C2B transactions

fix(rls): restrict petition updates to authenticated users only

docs(contributing): add branching strategy section

chore(deps): upgrade supabase-js to 2.108.2
---

## Pull / Merge Request Guidelines

- Keep MRs small and focused on a single concern.
- Write a clear description of what changed and why.
- Link the related issue using `Closes #<issue-number>`.
- Ensure `npm run lint` passes with zero errors.
- Add or update relevant comments for complex logic.
- Do not commit `.env*` files or secrets under any circumstances.
- Screenshots or screen recordings are appreciated for UI changes.

---

## Supabase & Environment Setup

### Required environment variables

```bash
# .env.local (Vite client)
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-supabase-anon-key
```

### M-Pesa Edge Function secrets

Set these via the Supabase CLI — never in source control:

```bash
supabase secrets set DARAJA_CONSUMER_KEY=...
supabase secrets set DARAJA_CONSUMER_SECRET=...
supabase secrets set DARAJA_PASSKEY=...
supabase secrets set DARAJA_SHORTCODE=...
supabase secrets set DARAJA_ENV=sandbox
supabase secrets set APP_URL=https://your-project-ref.supabase.co
```

### Applying migrations

```bash
supabase db push
```

Migrations run in filename order. Do not rename or reorder existing migration files.

---

## Code Style

- **TypeScript** is required for all new files. No plain `.js` in `src/`.
- **Tailwind CSS 4** utility classes only. No custom CSS unless absolutely necessary.
- **React hooks** over class components — always.
- **Named exports** preferred over default exports for components.
- Keep components under ~300 lines. Extract sub-components when things grow.
- Use `@/` path alias (`src/`) for all internal imports.
- All Supabase reads go through `useSupabase` or store hooks in `src/lib/store.ts`.
- All Supabase writes go through typed functions in `src/lib/mutations.ts`.

---

## Testing

Automated test infrastructure is on the roadmap. For now:

- Run the TypeScript compiler as a lint check: `npm run lint`
- Manually test citizen and admin flows against a Supabase sandbox project
- Verify RLS policies by testing as both authenticated and anonymous users
- Check M-Pesa flows against the Daraja sandbox environment

---

## Reporting Bugs

Open a GitLab issue with the label `bug` and include:

- A clear, descriptive title
- Steps to reproduce
- Expected vs actual behaviour
- Browser, OS, and Node.js version
- Relevant console errors or screenshots

---

## Requesting Features

Open a GitLab issue with the label `enhancement` and include:

- The problem you are trying to solve
- Your proposed solution or approach
- Any county-specific context that makes this relevant to devolved governance

---

## Questions?

Open a GitLab issue with the label `question`, or reach out via the repository discussions tab
