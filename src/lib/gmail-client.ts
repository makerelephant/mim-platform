/**
 * Gmail Client — Shared Gmail API authentication and utility functions.
 * Used by both the Gmail scanner and the Gmail actions API.
 */

import { google, gmail_v1 } from "googleapis";

// Default CEO email addresses for direction detection
export const DEFAULT_USER_EMAILS = [
  "mark@madeinmotion.co",
  "mark@mim.co",
  "markslater9@gmail.com",
];

/**
 * Create an authenticated Gmail API client from the GOOGLE_TOKEN env var.
 * Returns the gmail client instance.
 */
export async function createGmailClient(): Promise<gmail_v1.Gmail> {
  const tokenJson = process.env.GOOGLE_TOKEN;
  if (!tokenJson) {
    throw new Error("GOOGLE_TOKEN environment variable not set.");
  }

  const tokenData = JSON.parse(Buffer.from(tokenJson, "base64").toString("utf-8"));
  const oauth2Client = new google.auth.OAuth2(
    tokenData.client_id,
    tokenData.client_secret,
    "urn:ietf:wg:oauth:2.0:oob",
  );
  oauth2Client.setCredentials({
    access_token: tokenData.token,
    refresh_token: tokenData.refresh_token,
    token_type: "Bearer",
    expiry_date: tokenData.expiry ? new Date(tokenData.expiry).getTime() : undefined,
  });

  // Force refresh if expired
  const { credentials } = await oauth2Client.refreshAccessToken();
  oauth2Client.setCredentials(credentials);

  return google.gmail({ version: "v1", auth: oauth2Client });
}

/**
 * Get the labels on a specific message.
 */
export async function getMessageLabels(
  gmail: gmail_v1.Gmail,
  messageId: string,
): Promise<string[]> {
  const msg = await gmail.users.messages.get({
    userId: "me",
    id: messageId,
    format: "minimal",
  });
  return msg.data.labelIds || [];
}

/**
 * Get the latest message in a thread and its labels/metadata.
 */
export async function getThreadStatus(
  gmail: gmail_v1.Gmail,
  threadId: string,
  userEmails: string[] = DEFAULT_USER_EMAILS,
): Promise<{
  status: "replied" | "drafted" | "forwarded" | "starred" | "archived" | "unactioned";
  messageCount: number;
  lastMessageDirection: "inbound" | "outbound";
  lastMessageDate: string | null;
  hasDraft: boolean;
  isStarred: boolean;
  isInInbox: boolean;
}> {
  const userEmailSet = new Set(userEmails.map((e) => e.toLowerCase()));

  // Get full thread
  const thread = await gmail.users.threads.get({
    userId: "me",
    id: threadId,
    format: "metadata",
    metadataHeaders: ["From", "To", "Date"],
  });

  const messages = thread.data.messages || [];
  const messageCount = messages.length;

  // Check for drafts in this thread
  let hasDraft = false;
  try {
    const drafts = await gmail.users.drafts.list({ userId: "me" });
    if (drafts.data.drafts) {
      for (const draft of drafts.data.drafts) {
        if (draft.message?.threadId === threadId) {
          hasDraft = true;
          break;
        }
      }
    }
  } catch {
    // Draft check failed, non-fatal
  }

  // Analyze the latest message
  const lastMessage = messages[messages.length - 1];
  const lastLabels = lastMessage?.labelIds || [];
  const isStarred = messages.some((m) => m.labelIds?.includes("STARRED"));
  const isInInbox = messages.some((m) => m.labelIds?.includes("INBOX"));

  // Determine last message direction
  const lastHeaders: Record<string, string> = {};
  for (const h of lastMessage?.payload?.headers || []) {
    if (h.name && h.value) {
      lastHeaders[h.name.toLowerCase()] = h.value;
    }
  }

  const fromEmail = extractEmail(lastHeaders["from"] || "");
  const lastMessageDirection = userEmailSet.has(fromEmail) ? "outbound" : "inbound";

  // Last message date
  const lastMessageDate = lastMessage?.internalDate
    ? new Date(parseInt(lastMessage.internalDate)).toISOString()
    : null;

  // Determine status (priority order: replied > forwarded > drafted > starred > archived > unactioned)
  // Check if CEO has any outbound messages in this thread
  const hasOutbound = messages.some((m) => {
    const headers: Record<string, string> = {};
    for (const h of m.payload?.headers || []) {
      if (h.name && h.value) headers[h.name.toLowerCase()] = h.value;
    }
    return userEmailSet.has(extractEmail(headers["from"] || ""));
  });

  // Check if outbound was to different recipients (forwarded)
  let isForwarded = false;
  if (hasOutbound && messages.length >= 2) {
    const originalTo = new Set<string>();
    const firstHeaders: Record<string, string> = {};
    for (const h of messages[0]?.payload?.headers || []) {
      if (h.name && h.value) firstHeaders[h.name.toLowerCase()] = h.value;
    }
    for (const addr of (firstHeaders["to"] || "").split(",")) {
      originalTo.add(extractEmail(addr.trim()));
    }
    originalTo.add(extractEmail(firstHeaders["from"] || ""));

    // Check if any outbound message went to someone not in the original thread
    for (const m of messages) {
      const mHeaders: Record<string, string> = {};
      for (const h of m.payload?.headers || []) {
        if (h.name && h.value) mHeaders[h.name.toLowerCase()] = h.value;
      }
      if (userEmailSet.has(extractEmail(mHeaders["from"] || ""))) {
        const toAddrs = (mHeaders["to"] || "").split(",").map((a) => extractEmail(a.trim()));
        if (toAddrs.some((a) => a && !originalTo.has(a) && !userEmailSet.has(a))) {
          isForwarded = true;
          break;
        }
      }
    }
  }

  let status: "replied" | "drafted" | "forwarded" | "starred" | "archived" | "unactioned";
  if (hasOutbound && isForwarded) {
    status = "forwarded";
  } else if (hasOutbound && messages.length > 1) {
    status = "replied";
  } else if (hasDraft) {
    status = "drafted";
  } else if (isStarred) {
    status = "starred";
  } else if (!isInInbox) {
    status = "archived";
  } else {
    status = "unactioned";
  }

  return {
    status,
    messageCount,
    lastMessageDirection,
    lastMessageDate,
    hasDraft,
    isStarred,
    isInInbox,
  };
}

/**
 * Extract email address from a "Name <email>" string.
 */
function extractEmail(headerValue: string): string {
  const match = headerValue.match(/<([^>]+)>/);
  if (match) return match[1].toLowerCase().trim();
  return headerValue.toLowerCase().trim();
}

/**
 * Build a proper RFC 2822 email message for sending via Gmail API.
 */
export function buildRawEmail(opts: {
  to: string;
  from: string;
  subject: string;
  body: string;
  inReplyTo?: string;
  references?: string;
  threadId?: string;
}): string {
  const lines: string[] = [];
  lines.push(`From: ${opts.from}`);
  lines.push(`To: ${opts.to}`);
  lines.push(`Subject: ${opts.subject}`);
  lines.push("MIME-Version: 1.0");
  lines.push("Content-Type: text/plain; charset=utf-8");
  if (opts.inReplyTo) {
    lines.push(`In-Reply-To: ${opts.inReplyTo}`);
    lines.push(`References: ${opts.references || opts.inReplyTo}`);
  }
  lines.push("");
  lines.push(opts.body);

  const raw = lines.join("\r\n");
  // Gmail API expects URL-safe base64
  return Buffer.from(raw)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
