/**
 * Prompt Surface Layer — Index
 *
 * Central registry of all extractable agent prompts.
 * Each prompt module exports: PROMPT_ID, PROMPT_NAME, PROMPT_DESCRIPTION, PROMPT_AGENT,
 * and a function that generates the prompt text with dynamic context.
 */

import {
  PROMPT_ID as dailyBriefingId,
  PROMPT_NAME as dailyBriefingName,
  PROMPT_DESCRIPTION as dailyBriefingDesc,
  PROMPT_AGENT as dailyBriefingAgent,
  getDailyBriefingPrompt,
} from "./daily-briefing";

import {
  PROMPT_ID as weeklySynthesisId,
  PROMPT_NAME as weeklySynthesisName,
  PROMPT_DESCRIPTION as weeklySynthesisDesc,
  PROMPT_AGENT as weeklySynthesisAgent,
  getWeeklySynthesisPrompt,
} from "./weekly-synthesis";

import {
  PROMPT_ID as monthlyReportId,
  PROMPT_NAME as monthlyReportName,
  PROMPT_DESCRIPTION as monthlyReportDesc,
  PROMPT_AGENT as monthlyReportAgent,
  getMonthlyReportPrompt,
} from "./monthly-report";

import {
  PROMPT_ID as customReportId,
  PROMPT_NAME as customReportName,
  PROMPT_DESCRIPTION as customReportDesc,
  PROMPT_AGENT as customReportAgent,
  getCustomReportPrompt,
} from "./custom-report";

import {
  PROMPT_ID as brainAskId,
  PROMPT_NAME as brainAskName,
  PROMPT_DESCRIPTION as brainAskDesc,
  PROMPT_AGENT as brainAskAgent,
  getBrainAskPrompt,
} from "./brain-ask";

import {
  PROMPT_ID as brainIngestId,
  PROMPT_NAME as brainIngestName,
  PROMPT_DESCRIPTION as brainIngestDesc,
  PROMPT_AGENT as brainIngestAgent,
  getBrainIngestPrompt,
  getBrainIngestChunkPrompt,
  getBrainIngestSynthesisPrompt,
} from "./brain-ingest";

import {
  PROMPT_ID as brainSnapshotId,
  PROMPT_NAME as brainSnapshotName,
  PROMPT_DESCRIPTION as brainSnapshotDesc,
  PROMPT_AGENT as brainSnapshotAgent,
  getSnapshotPlanPrompt,
  getSnapshotFormatPrompt,
} from "./brain-snapshot";

export interface PromptDefinition {
  id: string;
  name: string;
  description: string;
  agent: string;
  /** Returns the default prompt text. For prompts that need dynamic context, pass placeholder values. */
  getDefaultText: () => string;
}

export const PROMPT_REGISTRY: PromptDefinition[] = [
  {
    id: dailyBriefingId,
    name: dailyBriefingName,
    description: dailyBriefingDesc,
    agent: dailyBriefingAgent,
    getDefaultText: () => getDailyBriefingPrompt("{{DATA_CONTEXT}}"),
  },
  {
    id: weeklySynthesisId,
    name: weeklySynthesisName,
    description: weeklySynthesisDesc,
    agent: weeklySynthesisAgent,
    getDefaultText: () => getWeeklySynthesisPrompt(),
  },
  {
    id: monthlyReportId,
    name: monthlyReportName,
    description: monthlyReportDesc,
    agent: monthlyReportAgent,
    getDefaultText: () => getMonthlyReportPrompt("{{DATA_PACKAGE_JSON}}"),
  },
  {
    id: customReportId,
    name: customReportName,
    description: customReportDesc,
    agent: customReportAgent,
    getDefaultText: () => getCustomReportPrompt("{{FOCUS}}", 30, "{{DATA_PACKAGE_JSON}}"),
  },
  {
    id: brainAskId,
    name: brainAskName,
    description: brainAskDesc,
    agent: brainAskAgent,
    getDefaultText: () => getBrainAskPrompt(),
  },
  {
    id: brainIngestId,
    name: brainIngestName,
    description: brainIngestDesc,
    agent: brainIngestAgent,
    getDefaultText: () =>
      getBrainIngestPrompt(
        "{{TAXONOMY_CONTEXT}}",
        "{{DOCUMENT_TITLE}}",
        "{{CONTENT_PREVIEW}}",
      ),
  },
  {
    id: brainSnapshotId,
    name: brainSnapshotName,
    description: brainSnapshotDesc,
    agent: brainSnapshotAgent,
    getDefaultText: () => getSnapshotPlanPrompt("{{QUERY}}", "{{CONTEXT}}"),
  },
];

// Re-export all prompt functions for direct use
export {
  getDailyBriefingPrompt,
  getWeeklySynthesisPrompt,
  getMonthlyReportPrompt,
  getCustomReportPrompt,
  getBrainAskPrompt,
  getBrainIngestPrompt,
  getBrainIngestChunkPrompt,
  getBrainIngestSynthesisPrompt,
  getSnapshotPlanPrompt,
  getSnapshotFormatPrompt,
};
