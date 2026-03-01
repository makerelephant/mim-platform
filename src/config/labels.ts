/**
 * Centralized labels for the entire platform.
 * Edit this file to rename menu items, page titles, and section headers.
 * Changes here will reflect across the sidebar nav, page headings, and breadcrumbs.
 */

export const labels = {
  /* ── Sidebar nav & page titles ── */
  dashboard: "Dashboard",
  contacts: "Contacts",

  // Super category headers
  superConversations: "Conversations",
  superOrganizations: "Organizations",
  superContent: "Content",
  superOrchestrations: "Orchestrations",
  superAccount: "Account",
  superEndPoints: "End Points",
  superApplications: "Applications",

  // Investor group
  investorGroup: "Investors",
  investors: "All Investors",
  pipeline: "Pipeline",
  transactions: "Transactions",

  // Communities group
  communitiesGroup: "Communities",
  soccerOrgs: "All Communities",
  channelPartners: "Channel Partners",

  // Content section
  newsSentiment: "News Sentiment",
  research: "Research",
  outreach: "Outreach",

  supportIssues: "Support Issues",
  tasks: "Tasks",
  activityLog: "Activity Log",

  /* ── Page subtitles / section headers (optional overrides) ── */
  investorsPageTitle: "Investors",
  transactionsPageTitle: "Market Transactions",
  contactsPageTitle: "Contacts",
  soccerOrgsPageTitle: "Communities",
  channelPartnersPageTitle: "Channel Partner Pipeline",
  pipelinePageTitle: "Investor Pipeline",
  supportIssuesPageTitle: "Support Issues",
  tasksPageTitle: "Tasks",
  activityLogPageTitle: "Activity Log",
  newsSentimentPageTitle: "News Sentiment",
  researchPageTitle: "Research",
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
  applications: "Applications",
  applicationsPageTitle: "Applications",
  agentDescription: "Description",
  agentSystemPrompt: "System Prompt",
  agentConfig: "Configuration",
  agentRecentRuns: "Recent Runs",
  agentMonitoredEmails: "Monitored Emails",
};

export type Labels = typeof labels;
