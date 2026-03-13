# Email Classification Rule: Product / Engineering

## Category ID
`product_engineering`

## Inbound From
- Internal engineering team (architecture decisions, blockers, incidents)
- Product managers (roadmap, prioritization, strategy)
- Customers with technical requests (integration, security, performance)
- Partners / integrations (API access, SDK, platform compatibility)
- Support / customer success escalations (bugs, outages)

## Outbound To
- CTO / head of engineering
- Product manager / head of product
- Engineering lead
- Solutions engineer
- DevOps / infrastructure engineer
- Customer success (for customer issues)

## Signals

### Production & Infrastructure
Incident, outage, production issue, service down, system failure, SEV1, SEV2, deployment, infrastructure, DevOps, build failure, deployment failure

### Security
Security vulnerability, data breach, unauthorized access, security alert, credential exposure, security review

### Product & Roadmap
Roadmap, feature priority, product strategy, launch planning, feature request, product direction, sprint planning, capacity planning

### Technical
Architecture, system design, technical blocker, API, integration, SDK, developer support, technical requirements, PR review, code review

### Customer-Facing Technical
Bug, customer escalation, blocking issue, enterprise customer bug, integration question, performance issue

## Importance

### High
- Production incidents / outages: incident, outage, service down, system failure, SEV1/SEV2
- Security or data risk: vulnerability, data breach, unauthorized access, credential exposure
- Critical customer-blocking issues: customer escalation, blocking issue, deployment failure
- Launch / release blockers: release blocker, build failure, launch issue

Priority order: system reliability → security risk → customer impact → release blockers

### Medium
- Feature development updates: implementation, PR review, progress
- Architecture discussions: architecture proposal, system design, design review
- Technical planning: sprint planning, roadmap, capacity planning

### Low
- Code review notifications: PR opened, review requested, commit notification
- Internal engineering updates: weekly summary, progress report
- Tooling / platform notifications: build completed, deployment success, monitoring report
