# Department: Product / Engineering

## Purpose
Defines how MiM Brain prioritizes and routes product and engineering activity.

## CEO Role
Decision-maker on strategy and roadmap. Routes technical execution to engineering and product leads.

## Routing Rules

| Topic | Internal Owner |
|-------|---------------|
| Bugs / outages | Engineering lead / CTO |
| Architecture discussions | Tech lead / CTO |
| Feature requests | Product manager |
| Customer integration | Solutions engineer / engineering |
| Product roadmap | Head of product |
| Technical support | Support engineering |
| Infrastructure issues | DevOps / infrastructure engineer |

## Priority Hierarchy

```
System reliability
  ↓
Security risk
  ↓
Customer impact
  ↓
Release blockers
  ↓
Feature development
  ↓
Informational updates
```

## Importance Model

### High (immediate attention)

| Situation | Signals | Risk |
|-----------|---------|------|
| Production incident / outage | Incident, outage, service down, SEV1/SEV2 | Direct customer and product impact |
| Security / data risk | Vulnerability, data breach, unauthorized access | Customer data exposure, system integrity |
| Customer-blocking issues | Customer escalation, blocking issue, enterprise bug | Customer unable to use product |
| Launch / release blockers | Release blocker, build failure, deployment failure | Stops product releases |

### Medium (important, not urgent)

| Situation | Signals |
|-----------|---------|
| Feature development | Implementation updates, PR review, progress |
| Architecture discussions | Architecture proposal, system design, design review |
| Technical planning | Sprint planning, roadmap, capacity planning |

### Low (informational)

| Situation | Signals |
|-----------|---------|
| Code review notifications | PR opened, review requested |
| Engineering updates | Weekly summary, progress report |
| Tooling notifications | Build completed, deployment success, CI pipeline |
