/**
 * Feedback Engine
 *
 * Computes per-entity usefulness scores from task outcomes.
 * Tracks: starred (valuable), completed (useful), ignored (7+ days todo),
 * manually edited (correction signal).
 *
 * The computed feedback is stored in `entity_feedback` and injected into
 * the classifier prompt via entity dossiers.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

/* ── Types ── */

interface EntityFeedbackRow {
  entity_type: string;
  entity_id: string;
  total_tasks_created: number;
  tasks_starred: number;
  tasks_completed: number;
  tasks_ignored: number;
  tasks_manually_edited: number;
  avg_goal_relevance: number | null;
  usefulness_score: number;
  common_tags: string[];
  typical_priority: string | null;
}

interface TaskRow {
  id: string;
  status: string;
  is_starred: boolean | null;
  manually_edited: boolean | null;
  goal_relevance_score: number | null;
  priority: string;
  created_at: string;
}

/* ── Compute Feedback for Single Entity ── */

/**
 * Compute feedback for a single entity based on its task history.
 * UPSERTs into `entity_feedback` table.
 */
export async function computeEntityFeedback(
  sb: SupabaseClient,
  entityType: string,
  entityId: string,
): Promise<EntityFeedbackRow | null> {
  if (!entityId) return null;

  // Fetch all tasks for this entity
  const { data: tasks } = await sb
    .schema('brain').from("tasks")
    .select("id, status, is_starred, manually_edited, goal_relevance_score, priority, created_at")
    .eq("entity_id", entityId)
    .order("created_at", { ascending: false });

  if (!tasks || tasks.length === 0) return null;

  const taskRows = tasks as TaskRow[];
  const now = Date.now();
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

  // Count signals
  let tasksStarred = 0;
  let tasksCompleted = 0;
  let tasksIgnored = 0;
  let tasksManuallyEdited = 0;
  let goalRelevanceSum = 0;
  let goalRelevanceCount = 0;
  const priorityCounts: Record<string, number> = {};

  for (const task of taskRows) {
    if (task.is_starred) tasksStarred++;
    if (task.status === "done") tasksCompleted++;
    if (task.manually_edited) tasksManuallyEdited++;

    // "Ignored" = still in todo after 7+ days, not starred
    if (
      task.status === "todo" &&
      !task.is_starred &&
      now - new Date(task.created_at).getTime() > sevenDaysMs
    ) {
      tasksIgnored++;
    }

    if (task.goal_relevance_score != null) {
      goalRelevanceSum += task.goal_relevance_score;
      goalRelevanceCount++;
    }

    priorityCounts[task.priority] = (priorityCounts[task.priority] || 0) + 1;
  }

  // Compute usefulness score: (starred*2 + completed) / (total*2), clamped [0, 1]
  const totalTasks = taskRows.length;
  const rawScore = totalTasks > 0
    ? (tasksStarred * 2 + tasksCompleted) / (totalTasks * 2)
    : 0;
  const usefulnessScore = Math.min(1, Math.max(0, rawScore));

  // Avg goal relevance
  const avgGoalRelevance = goalRelevanceCount > 0
    ? Math.round((goalRelevanceSum / goalRelevanceCount) * 10) / 10
    : null;

  // Most common priority
  let typicalPriority: string | null = null;
  let maxPriorityCount = 0;
  for (const [priority, count] of Object.entries(priorityCounts)) {
    if (count > maxPriorityCount) {
      maxPriorityCount = count;
      typicalPriority = priority;
    }
  }

  const feedbackRow: EntityFeedbackRow = {
    entity_type: entityType,
    entity_id: entityId,
    total_tasks_created: totalTasks,
    tasks_starred: tasksStarred,
    tasks_completed: tasksCompleted,
    tasks_ignored: tasksIgnored,
    tasks_manually_edited: tasksManuallyEdited,
    avg_goal_relevance: avgGoalRelevance,
    usefulness_score: usefulnessScore,
    common_tags: [], // TODO: extract from classification_log when available
    typical_priority: typicalPriority,
  };

  // UPSERT into entity_feedback
  await sb.from("entity_feedback").upsert(
    {
      entity_type: entityType,
      entity_id: entityId,
      total_tasks_created: totalTasks,
      tasks_starred: tasksStarred,
      tasks_completed: tasksCompleted,
      tasks_ignored: tasksIgnored,
      tasks_manually_edited: tasksManuallyEdited,
      avg_goal_relevance: avgGoalRelevance,
      usefulness_score: usefulnessScore,
      common_tags: [],
      typical_priority: typicalPriority,
      computed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "entity_type,entity_id" },
  );

  return feedbackRow;
}

/* ── Batch Compute All Entity Feedback ── */

/**
 * Compute feedback for all entities that have tasks.
 * Intended to run after each scanner run or as a periodic job.
 *
 * @returns Number of entities processed
 */
export async function computeAllEntityFeedback(
  sb: SupabaseClient,
): Promise<number> {
  // Get distinct entity_ids from tasks
  const { data: entities } = await sb
    .schema('brain').from("tasks")
    .select("entity_type, entity_id")
    .not("entity_id", "is", null)
    .not("entity_type", "is", null);

  if (!entities) return 0;

  // Deduplicate
  const unique = new Map<string, { entity_type: string; entity_id: string }>();
  for (const row of entities) {
    const key = `${row.entity_type}:${row.entity_id}`;
    if (!unique.has(key)) {
      unique.set(key, row);
    }
  }

  // Compute feedback for each (batch, not parallel to avoid hammering DB)
  let processed = 0;
  for (const entity of unique.values()) {
    await computeEntityFeedback(sb, entity.entity_type, entity.entity_id);
    processed++;
  }

  return processed;
}

/* ── Compute Feedback for Specific Entities (after scan) ── */

/**
 * Compute feedback for a specific set of entities.
 * Used at the end of a scanner run to update only the entities involved.
 */
export async function computeFeedbackForEntities(
  sb: SupabaseClient,
  entities: Array<{ entity_type: string; entity_id: string }>,
): Promise<number> {
  // Deduplicate
  const unique = new Map<string, { entity_type: string; entity_id: string }>();
  for (const e of entities) {
    if (e.entity_id) {
      const key = `${e.entity_type}:${e.entity_id}`;
      if (!unique.has(key)) {
        unique.set(key, e);
      }
    }
  }

  let processed = 0;
  for (const entity of unique.values()) {
    await computeEntityFeedback(sb, entity.entity_type, entity.entity_id);
    processed++;
  }

  return processed;
}
