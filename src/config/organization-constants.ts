/* ── Organization type (multi-select on each org) ── */
export const ORG_TYPE_OPTIONS = [
  "Investor",
  "Partner",
  "Customer",
  "Vendor",
  "Competitor",
] as const;

export type OrgType = (typeof ORG_TYPE_OPTIONS)[number];

/* ── Lifecycle status ── */
export const LIFECYCLE_STATUS_OPTIONS = [
  "target",
  "pipeline",
  "active",
  "inactive",
] as const;

export type LifecycleStatus = (typeof LIFECYCLE_STATUS_OPTIONS)[number];

/* ── Opportunity / Deal ── */
export const OPPORTUNITY_STAGES = [
  "Prospect",
  "Qualified",
  "Engaged",
  "First Meeting",
  "In Closing",
  "Closed Won",
  "Closed Lost",
] as const;

export const DEAL_TYPES = ["fundraising", "partnership"] as const;

export type OpportunityStage = (typeof OPPORTUNITY_STAGES)[number];
export type DealType = (typeof DEAL_TYPES)[number];

/* ── Legacy constants (kept for backward compat during transition) ── */
export const ORG_CATEGORY_OPTIONS = [
  "Investment Firm",
  "Youth Soccer",
  "Retail",
  "Church Group",
  "School",
  "Recreation Center",
  "League",
  "Other",
];

export const RELATIONSHIP_OPTIONS = [
  "Partner",
  "Customer",
  "Investor",
  "Acquirer",
  "Service Provider",
  "Prospect",
  "Other",
];

/* ── Connection & pipeline status (investor-specific, legacy) ── */
export const CONNECTION_STATUSES = [
  "Active",
  "Stale",
  "Need Introduction",
  "Warm Intro",
  "Cold",
];

export const PIPELINE_STATUSES = [
  "Prospect",
  "Qualified",
  "Engaged",
  "First Meeting",
  "In Closing",
  "Closed",
  "Passed",
  "Not a Fit",
];

/* ── Outreach / partner status (community-specific) ── */
export const OUTREACH_STATUSES = [
  "Not Contacted",
  "Initial Outreach",
  "In Conversation",
  "Meeting Scheduled",
  "Proposal Sent",
  "Negotiating",
  "Closed",
];

export const PARTNER_STATUSES = [
  "Prospect",
  "Active Partner",
  "Inactive",
  "Churned",
];
