/**
 * Centralized labels for the entire platform.
 * Edit this file to rename menu items, page titles, and section headers.
 * Changes here will reflect across the sidebar nav, page headings, and breadcrumbs.
 */

export const labels = {
  /* ── Dashboard ── */
  dashboard: "Dashboard",

  /* ── Super category headers ── */
  superFundraising: "Fundraising",
  superPartnerships: "Partnerships",
  superCommunities: "Communities",
  superActivity: "Activity",
  superPeople: "People",
  superSentiment: "Sentiment",
  superOrchestrations: "Orchestrations",
  superSettings: "Settings",

  /* ── Fundraising section ── */
  fundraisingPipeline: "Pipeline",
  investors: "Investors",
  investorContacts: "Investor Contacts",
  fundraisingActivity: "Activity",

  /* ── Partnerships section ── */
  partnerOrgs: "Partner Orgs",
  categoryGeoAssignments: "Category × Geo",
  partnershipPipeline: "Partnership Pipeline",

  /* ── Communities section ── */
  allCommunities: "All Communities",
  shareLinks: "Share Links",
  moments: "Moments",
  communityOrgMap: "Community → Org Map",

  /* ── Activity section ── */
  tasks: "Tasks",
  supportIssues: "Support",
  activityLog: "Activity Log",

  /* ── People section ── */
  contacts: "Contacts",
  roles: "Roles",
  creators: "Creators",

  /* ── Sentiment section ── */
  newsSentiment: "News Sentiment",
  research: "Research",

  /* ── Orchestrations section ── */
  applications: "Applications",
  campaigns: "Campaigns",
  endPoints: "End Points",

  /* ── Settings section ── */
  fieldsEnums: "Fields / Enums",
  integrations: "Integrations",
  usersPermissions: "Users / Permissions",

  /* ── Page titles ── */
  investorsPageTitle: "Investors",
  pipelinePageTitle: "Fundraising Pipeline",
  partnerOrgsPageTitle: "Partner Organizations",
  partnershipPipelinePageTitle: "Partnership Pipeline",
  communitiesPageTitle: "Communities",
  contactsPageTitle: "Contacts",
  rolesPageTitle: "Contact Roles",
  investorContactsPageTitle: "Investor Contacts",
  categoryGeoPageTitle: "Category × Geo Assignments",
  tasksPageTitle: "Tasks",
  supportIssuesPageTitle: "Support Issues",
  activityLogPageTitle: "Activity Log",
  newsSentimentPageTitle: "News Sentiment",
  researchPageTitle: "Research",
  applicationsPageTitle: "Applications",

  /* ── Legacy page titles (still used by existing pages) ── */
  transactionsPageTitle: "Market Transactions",
  channelPartnersPageTitle: "Partner Organizations",
  soccerOrgsPageTitle: "Communities",
  outreachPageTitle: "Outreach",

  /* ── Task detail page ── */
  taskSummary: "Summary",
  taskRecommendedAction: "Recommended Action",
  taskGoalRelevance: "Goal Relevance",
  taskNotes: "Notes",
  taskDetails: "Task Details",
  taskSourceInfo: "Source",

  /* ── Batch A additions ── */
  taskScanButton: "Scan for new Tasks",
  taskLastScanned: "Last scanned",
  taskRelatedTasks: "Related Tasks",
  taskStar: "Star",
  contactLastInteraction: "Last Interaction",

  /* ── Applications / Agents ── */
  agentDescription: "Description",
  agentSystemPrompt: "System Prompt",
  agentConfig: "Configuration",
  agentRecentRuns: "Recent Runs",
  agentMonitoredEmails: "Monitored Emails",

  /* ── Periodic Updates / Reports ── */
  periodicUpdates: "Periodic Updates",
  runWeeklyReport: "Run Weekly Report",
  reportTitle: "Updates for",
};

export type Labels = typeof labels;
