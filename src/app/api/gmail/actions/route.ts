import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import { createGmailClient, getThreadStatus, buildRawEmail, DEFAULT_USER_EMAILS } from "@/lib/gmail-client";

export const maxDuration = 60;

/**
 * POST /api/gmail/actions
 *
 * Execute Gmail actions from In Motion feed cards.
 *
 * Body:
 *   action: "reply" | "draft" | "archive" | "star"
 *   card_id: string (feed card ID)
 *   thread_id: string (Gmail thread ID)
 *   message?: string (reply/draft body — if omitted for "draft", brain generates one)
 *
 * GET /api/gmail/actions?thread_id=xxx
 *
 * Get the current Gmail thread status for a feed card.
 */

export async function GET(request: NextRequest) {
  try {
    const threadId = request.nextUrl.searchParams.get("thread_id");
    if (!threadId) {
      return NextResponse.json({ error: "thread_id required" }, { status: 400 });
    }

    const gmail = await createGmailClient();
    const status = await getThreadStatus(gmail, threadId);

    return NextResponse.json({ success: true, ...status });
  } catch (err) {
    console.error("Gmail status check error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, card_id, thread_id, message } = body as {
      action: "reply" | "draft" | "archive" | "star";
      card_id?: string;
      thread_id: string;
      message?: string;
    };

    if (!action || !thread_id) {
      return NextResponse.json(
        { error: "action and thread_id required" },
        { status: 400 },
      );
    }

    const gmail = await createGmailClient();

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
    const sb = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

    let result: Record<string, unknown> = {};

    switch (action) {
      case "reply": {
        result = await handleReply(gmail, sb, { thread_id, card_id, message });
        break;
      }
      case "draft": {
        result = await handleDraft(gmail, sb, { thread_id, card_id, message });
        break;
      }
      case "archive": {
        result = await handleArchive(gmail, sb, { thread_id, card_id });
        break;
      }
      case "star": {
        result = await handleStar(gmail, sb, { thread_id, card_id });
        break;
      }
      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

    return NextResponse.json({ success: true, action, ...result });
  } catch (err) {
    console.error("Gmail action error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// ─── Action Handlers ─────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

interface ActionContext {
  thread_id: string;
  card_id?: string;
  message?: string;
}

/**
 * REPLY — Send a threaded Gmail reply.
 * If message is provided, send it. Otherwise return an error (compose required).
 */
async function handleReply(
  gmail: Awaited<ReturnType<typeof createGmailClient>>,
  sb: SB | null,
  ctx: ActionContext,
): Promise<Record<string, unknown>> {
  if (!ctx.message?.trim()) {
    return { error: "Reply message required. Use 'draft' action for brain-generated drafts." };
  }

  // Get thread to find the last message headers
  const thread = await gmail.users.threads.get({
    userId: "me",
    id: ctx.thread_id,
    format: "metadata",
    metadataHeaders: ["From", "To", "Cc", "Subject", "Message-ID", "References"],
  });

  const messages = thread.data.messages || [];
  if (messages.length === 0) {
    return { error: "Thread not found or empty" };
  }

  // Find the last inbound message to reply to
  const userEmailSet = new Set(DEFAULT_USER_EMAILS.map((e) => e.toLowerCase()));
  let replyToMsg = messages[messages.length - 1]; // default to last
  for (let i = messages.length - 1; i >= 0; i--) {
    const headers: Record<string, string> = {};
    for (const h of messages[i].payload?.headers || []) {
      if (h.name && h.value) headers[h.name.toLowerCase()] = h.value;
    }
    const from = extractEmailFromHeader(headers["from"] || "");
    if (!userEmailSet.has(from)) {
      replyToMsg = messages[i];
      break;
    }
  }

  const replyHeaders: Record<string, string> = {};
  for (const h of replyToMsg.payload?.headers || []) {
    if (h.name && h.value) replyHeaders[h.name.toLowerCase()] = h.value;
  }

  const replyTo = replyHeaders["from"] || "";
  const subject = replyHeaders["subject"] || "";
  const messageId = replyHeaders["message-id"] || "";
  const references = replyHeaders["references"] || "";

  const raw = buildRawEmail({
    to: replyTo,
    from: DEFAULT_USER_EMAILS[0],
    subject: subject.startsWith("Re:") ? subject : `Re: ${subject}`,
    body: ctx.message,
    inReplyTo: messageId,
    references: references ? `${references} ${messageId}` : messageId,
    threadId: ctx.thread_id,
  });

  const sent = await gmail.users.messages.send({
    userId: "me",
    requestBody: {
      raw,
      threadId: ctx.thread_id,
    },
  });

  // Update feed card status
  if (sb && ctx.card_id) {
    await resolveCard(sb, ctx.card_id, "replied", {
      gmail_reply_id: sent.data.id,
      replied_to: replyTo,
      replied_at: new Date().toISOString(),
    });
  }

  return {
    gmail_message_id: sent.data.id,
    replied_to: replyTo,
    thread_status: "replied",
  };
}

/**
 * DRAFT — Create a draft reply in Gmail.
 * If message is provided, use it. Otherwise, have the brain generate a suggested reply.
 */
async function handleDraft(
  gmail: Awaited<ReturnType<typeof createGmailClient>>,
  sb: SB | null,
  ctx: ActionContext,
): Promise<Record<string, unknown>> {
  // Get thread for context
  const thread = await gmail.users.threads.get({
    userId: "me",
    id: ctx.thread_id,
    format: "full",
  });

  const messages = thread.data.messages || [];
  if (messages.length === 0) {
    return { error: "Thread not found or empty" };
  }

  // Find the last inbound message
  const userEmailSet = new Set(DEFAULT_USER_EMAILS.map((e) => e.toLowerCase()));
  let replyToMsg = messages[messages.length - 1];
  for (let i = messages.length - 1; i >= 0; i--) {
    const headers: Record<string, string> = {};
    for (const h of messages[i].payload?.headers || []) {
      if (h.name && h.value) headers[h.name.toLowerCase()] = h.value;
    }
    const from = extractEmailFromHeader(headers["from"] || "");
    if (!userEmailSet.has(from)) {
      replyToMsg = messages[i];
      break;
    }
  }

  const replyHeaders: Record<string, string> = {};
  for (const h of replyToMsg.payload?.headers || []) {
    if (h.name && h.value) replyHeaders[h.name.toLowerCase()] = h.value;
  }

  const replyTo = replyHeaders["from"] || "";
  const subject = replyHeaders["subject"] || "";
  const messageId = replyHeaders["message-id"] || "";
  const references = replyHeaders["references"] || "";

  // If no message provided, generate one with the brain
  let draftBody = ctx.message?.trim() || "";

  if (!draftBody) {
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (anthropicKey) {
      try {
        // Extract thread content for context
        const threadContent = messages
          .map((m) => {
            const h: Record<string, string> = {};
            for (const hdr of m.payload?.headers || []) {
              if (hdr.name && hdr.value) h[hdr.name.toLowerCase()] = hdr.value;
            }
            const body = getPlainTextBody(m.payload);
            return `From: ${h["from"]}\nDate: ${h["date"]}\nSubject: ${h["subject"]}\n\n${body}`;
          })
          .join("\n---\n");

        // Get entity context if we have a card
        let entityContext = "";
        if (sb && ctx.card_id) {
          try {
            const { data: card } = await sb
              .schema("brain")
              .from("feed_cards")
              .select("entity_name, entity_type, entity_id, acumen_category, reasoning, body")
              .eq("id", ctx.card_id)
              .single();
            if (card) {
              entityContext = [
                card.entity_name ? `Entity: ${card.entity_name}` : "",
                card.acumen_category ? `Category: ${card.acumen_category}` : "",
                card.reasoning ? `Brain's analysis: ${card.reasoning}` : "",
              ]
                .filter(Boolean)
                .join("\n");
            }
          } catch { /* non-fatal */ }
        }

        const anthropic = new Anthropic({ apiKey: anthropicKey });
        const response = await anthropic.messages.create({
          model: "claude-sonnet-4-6",
          max_tokens: 800,
          system: `You are drafting a brief, professional email reply on behalf of Mark Slater, CEO of Made in Motion PBC.

Rules:
- Be concise and warm but professional
- Match the tone of the conversation
- Don't over-explain or be verbose
- Sign off simply as "Mark" or "Best, Mark"
- If the email requires specific information you don't have, write [PLACEHOLDER] where the CEO needs to fill in details
- Never fabricate specific dates, numbers, or commitments

${entityContext ? `\nContext about this relationship:\n${entityContext}` : ""}`,
          messages: [
            {
              role: "user",
              content: `Draft a reply to this email thread. Write ONLY the reply body (no subject line).\n\nThread:\n${threadContent.slice(0, 15000)}`,
            },
          ],
        });

        draftBody = (response.content[0] as { type: "text"; text: string }).text.trim();
      } catch (aiErr) {
        console.error("Brain draft generation failed:", aiErr);
        draftBody = "[Draft reply here]";
      }
    } else {
      draftBody = "[Draft reply here]";
    }
  }

  const raw = buildRawEmail({
    to: replyTo,
    from: DEFAULT_USER_EMAILS[0],
    subject: subject.startsWith("Re:") ? subject : `Re: ${subject}`,
    body: draftBody,
    inReplyTo: messageId,
    references: references ? `${references} ${messageId}` : messageId,
    threadId: ctx.thread_id,
  });

  const draft = await gmail.users.drafts.create({
    userId: "me",
    requestBody: {
      message: {
        raw,
        threadId: ctx.thread_id,
      },
    },
  });

  // Update feed card status
  if (sb && ctx.card_id) {
    await resolveCard(sb, ctx.card_id, "drafted", {
      gmail_draft_id: draft.data.id,
      drafted_to: replyTo,
      drafted_at: new Date().toISOString(),
      brain_generated: !ctx.message,
    });
  }

  return {
    gmail_draft_id: draft.data.id,
    drafted_to: replyTo,
    draft_body: draftBody,
    brain_generated: !ctx.message,
    thread_status: "drafted",
  };
}

/**
 * ARCHIVE — Remove from inbox (Gmail INBOX label).
 */
async function handleArchive(
  gmail: Awaited<ReturnType<typeof createGmailClient>>,
  sb: SB | null,
  ctx: ActionContext,
): Promise<Record<string, unknown>> {
  // Get all messages in thread
  const thread = await gmail.users.threads.get({
    userId: "me",
    id: ctx.thread_id,
    format: "minimal",
  });

  const messages = thread.data.messages || [];

  // Remove INBOX label from all messages in thread
  for (const msg of messages) {
    if (msg.id && msg.labelIds?.includes("INBOX")) {
      await gmail.users.messages.modify({
        userId: "me",
        id: msg.id,
        requestBody: {
          removeLabelIds: ["INBOX"],
        },
      });
    }
  }

  // Update feed card status
  if (sb && ctx.card_id) {
    await resolveCard(sb, ctx.card_id, "archived", {
      archived_at: new Date().toISOString(),
    });
  }

  return { thread_status: "archived" };
}

/**
 * STAR — Toggle star on the latest message in the thread.
 */
async function handleStar(
  gmail: Awaited<ReturnType<typeof createGmailClient>>,
  sb: SB | null,
  ctx: ActionContext,
): Promise<Record<string, unknown>> {
  // Get thread
  const thread = await gmail.users.threads.get({
    userId: "me",
    id: ctx.thread_id,
    format: "minimal",
  });

  const messages = thread.data.messages || [];
  if (messages.length === 0) {
    return { error: "Thread not found or empty" };
  }

  // Star the latest message
  const lastMsg = messages[messages.length - 1];
  const isAlreadyStarred = lastMsg.labelIds?.includes("STARRED");

  if (lastMsg.id) {
    await gmail.users.messages.modify({
      userId: "me",
      id: lastMsg.id,
      requestBody: isAlreadyStarred
        ? { removeLabelIds: ["STARRED"] }
        : { addLabelIds: ["STARRED"] },
    });
  }

  const newStatus = isAlreadyStarred ? "unactioned" : "starred";

  // Update feed card
  if (sb && ctx.card_id) {
    await resolveCard(sb, ctx.card_id, newStatus, {
      starred_at: isAlreadyStarred ? null : new Date().toISOString(),
      unstarred_at: isAlreadyStarred ? new Date().toISOString() : null,
    });
  }

  return {
    starred: !isAlreadyStarred,
    thread_status: newStatus,
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function extractEmailFromHeader(headerValue: string): string {
  const match = headerValue.match(/<([^>]+)>/);
  if (match) return match[1].toLowerCase().trim();
  return headerValue.toLowerCase().trim();
}

/**
 * Extract plain text body from a Gmail message payload.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getPlainTextBody(payload: any): string {
  if (!payload) return "";

  // Direct body
  if (payload.mimeType === "text/plain" && payload.body?.data) {
    return Buffer.from(payload.body.data, "base64").toString("utf-8");
  }

  // Multipart — find text/plain part
  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === "text/plain" && part.body?.data) {
        return Buffer.from(part.body.data, "base64").toString("utf-8");
      }
      // Recurse into nested multipart
      if (part.parts) {
        const nested = getPlainTextBody(part);
        if (nested) return nested;
      }
    }
  }

  return "";
}

/**
 * Update feed card to reflect Gmail action status.
 */
async function resolveCard(
  sb: SB,
  cardId: string,
  threadStatus: string,
  actionMeta: Record<string, unknown>,
): Promise<void> {
  try {
    // Get current card metadata
    const { data: card } = await sb
      .schema("brain")
      .from("feed_cards")
      .select("metadata, status")
      .eq("id", cardId)
      .single();

    const existingMeta = (card?.metadata as Record<string, unknown>) || {};

    const updates: Record<string, unknown> = {
      metadata: {
        ...existingMeta,
        thread_status: threadStatus,
        ...actionMeta,
        action_source: "in_motion",
      },
      updated_at: new Date().toISOString(),
    };

    // For reply/archive, mark as acted
    if (threadStatus === "replied" || threadStatus === "archived") {
      updates.status = "acted";
      updates.ceo_action = "do";
      updates.ceo_action_at = new Date().toISOString();
      updates.ceo_action_note = `Auto-resolved: ${threadStatus} from In Motion`;
    }

    await sb
      .schema("brain")
      .from("feed_cards")
      .update(updates)
      .eq("id", cardId);

    // Log to decision_log
    try {
      await sb.schema("brain").from("decision_log").insert({
        card_id: cardId,
        action: threadStatus === "replied" || threadStatus === "archived" ? "do" : "not_now",
        note: `${threadStatus} from In Motion`,
        method: `gmail_${threadStatus}`,
      });
    } catch { /* ignore */ }
  } catch (err) {
    console.error(`Failed to update card ${cardId} with status ${threadStatus}:`, err);
  }
}
