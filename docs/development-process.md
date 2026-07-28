# Development Process

> How the team works: methodology, version control, continuous integration, and deployment strategy.

---

## 1. Development Methodology

### GitFlow as Version Control Framework

We follow GitFlow with two long-lived branches:

| Branch | Purpose | Deploys to |
|--------|---------|------------|
| `main` | Production-ready code | Production environment |
| `develop` | Integration branch | Development environment |

Feature work happens in short-lived branches created from `develop`:
```
develop → feature/my-feature → PR → develop
```

### Spec-Driven Development

Our development cycle starts with structured specifications, not ad-hoc tasks:

1. **Requirements** are defined in `.kiro/specs/` as formal documents
2. **Design** documents detail the technical approach for each requirement
3. **Task slicing** breaks designs into implementable units
4. **Issues** are created from those sliced tasks — each one maps to a concrete deliverable
5. **Sub-issues** provide further granularity when a task spans multiple concerns

This approach ensures every line of code traces back to a requirement, and no work is started without understanding the "why" behind it.

### Issue and Sub-Issue System

GitHub Issues serve as our work tracking system:

- **Parent issues** represent a feature or capability (e.g., "Online Services")
- **Sub-issues** break features into atomic deliverables (e.g., "Authentication Service", "Leaderboard Service")
- Each sub-issue is sized to be completed in a single PR
- Issues reference the spec requirements they fulfill

### GitHub Projects

We use GitHub Projects as a Kanban board to visualize work in progress, track blockers, and ensure nothing falls through the cracks.

### Pull Requests as Quality Gates

Every change enters `develop` through a Pull Request:
- PRs reference the issue they close (`Closes #N`)
- CI checks must pass before merge
- PRs contain a summary of changes, what was tested, and any known limitations
- Atomic commits within each PR tell a story of how the feature was built

### Atomic Commits

Each commit represents a single logical change — a safe checkpoint:
- If something breaks, we can rollback to the previous commit without losing an entire day of work
- Commit messages follow conventional commits: `feat(scope): description`
- Each commit compiles and doesn't break existing functionality

---

## 2. Continuous Integration (CI)

Three automated quality gates run on every Pull Request targeting `develop` or `main`:

### Prettier Check (`prettier-check.yml`)
- **What:** Verifies all code in `frontend/` and `backend/` is formatted per `.prettierrc`
- **Blocks merge:** Yes — inconsistent formatting is not accepted
- **Fix:** Developer runs `prettier --write frontend/ backend/` locally

### ESLint Validation (`eslint-check.yml`)
- **What:** Validates TypeScript code against project ESLint rules
- **Blocks merge:** Yes — on errors only (warnings are informational)
- **Config per project:**
  - Root `.eslintrc.json`: shared rules (no-explicit-any, no-unused-vars)
  - `frontend/.eslintrc.json`: browser env, no-console: warn
  - `backend/.eslintrc.json`: node env, no-console: off (CloudWatch needs it)

### Frontend Build Validation (`frontend-build-check.yml`)
- **What:** Runs `tsc --noEmit && vite build` in a clean CI environment
- **Blocks merge:** Yes — broken builds cannot reach protected branches
- **Triggers only when:** `frontend/**`, `package.json`, `pnpm-lock.yaml`, or `tsconfig.base.json` change

### Common Behavior
- All three skip **draft PRs** (saves CI resources during active development)
- All three support **manual dispatch** for on-demand execution
- Node 22 + pnpm (version from `packageManager` field — no conflicts)

---

## 3. Continuous Deployment (CD)

### Two Environments, One Workflow

| Branch | Environment | Stack suffix |
|--------|-------------|:---:|
| `develop` | Development | `-dev` |
| `main` | Production | `-prod` |

The environment is derived from the branch name — no manual configuration needed:
```yaml
ENVIRONMENT: ${{ github.ref_name == 'main' && 'prod' || 'dev' }}
```

### Infrastructure Deployment (`deploy-infra.yml`)

Deploys AWS resources via CDK when infrastructure code changes:

```
Push to develop/main
  → Path filter: backend/cdk/** or backend/lambdas/** changed?
    → NO: skip entirely (saves time and AWS API calls)
    → YES: run cdk diff against live CloudFormation stack
      → No real differences? Skip deploy (comment or formatting change)
      → Real differences? cdk deploy --all
```

**Why this two-step approach?**
- Path filter is fast (git-level, no AWS calls) — filters out 90% of merges
- `cdk diff` is accurate (compares against live state) — catches the edge cases
- Manual dispatch always runs `cdk diff` → deploy, regardless of path changes (for drift recovery)

### Frontend Deployment (`deploy-frontend.yml`)

Deploys the game to S3 + CloudFront when frontend code changes:

```
Push to develop/main
  → Path filter: frontend/** changed?
    → NO: skip
    → YES:
      1. pnpm install + pnpm build
      2. Query CloudFormation for BucketName and DistributionId
      3. aws s3 sync dist/ → S3 (with differentiated cache headers)
      4. CloudFront invalidation on /index.html
```

**Cache strategy:**
- Hashed assets (JS, CSS, images): `max-age=31536000, immutable` — browser caches forever
- `index.html`: `max-age=60` — picks up new deployments within a minute

**Why query CloudFormation instead of hardcoding?**
If CDK ever recreates the bucket (name change, policy update), the workflow automatically resolves the new name. No manual secret updates needed.

---

## Tools and Services Used

| Tool | Purpose |
|------|---------|
| **pnpm** | Package manager (workspaces for monorepo) |
| **Vite** | Frontend bundler and dev server |
| **TypeScript** | Type safety across frontend and backend |
| **ESLint** | Code quality enforcement |
| **Prettier** | Consistent code formatting |
| **GitHub Actions** | CI/CD automation |
| **GitHub Projects** | Task tracking and sprint planning |
| **AWS CDK** | Infrastructure as Code |
| **Kiro** | AI-assisted development (specs, steering, hooks) |
