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
  superGophers: "Gophers",
  superSettings: "Settings",

  /* ── Fundraising section ── */
  investors: "Investors",
  investorContacts: "Contacts",
  fundraisingPipeline: "Pipeline",
  fundraisingActivity: "Activities",
  fundraisingTasks: "Tasks",

  /* ── Partnerships section ── */
  partnerOrgs: "Organizations",
  partnerCategories: "Categories",
  partnershipPipeline: "Pipeline",
  partnershipActivities: "Activities",
  partnershipTasks: "Tasks",

  /* ── Communities section ── */
  allCommunities: "Organizations",
  communityCategories: "Categories",
  communityActivities: "Activities",
  communityTasks: "Tasks",

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

  /* ── Gophers section ── */
  gophers: "Gophers",
  knowledgeBase: "Knowledge",
  campaigns: "Campaigns",
  endPoints: "End Points",

  /* ── Settings section ── */
  taxonomy: "Taxonomy",
  fieldsEnums: "Fields / Enums",
  integrations: "Integrations",
  usersPermissions: "Users / Permissions",

  /* ── Intelligence ── */
  intelligence: "Intelligence",

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
  gophersPageTitle: "Gophers",

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

  /* ── Gophers (detail page) ── */
  gopherDescription: "Description",
  gopherInstructions: "Instructions",
  gopherGoals: "90-Day Goals",
  gopherConfig: "Configuration",
  gopherRecentRuns: "Recent Runs",
  gopherMonitoredEmails: "Monitored Emails",

  /* ── Periodic Updates / Reports ── */
  periodicUpdates: "Periodic Updates",
  runWeeklyReport: "Run Weekly Report",
  reportTitle: "Updates for",
};

export type Labels = typeof labels;
