/**
 * Scanner Pre-filter
 *
 * Pure functions that inspect email headers and message metadata BEFORE
 * any AI classifier call. Catches newsletters, auto-replies, marketing
 * blasts, and noreply senders — saving Claude API tokens and reducing
 * task noise.
 */

/* ── Types ── */

export interface PreFilterResult {
  action: "skip" | "auto_classify" | "pass";
  reason: string;
  category: "newsletter" | "auto_reply" | "marketing" | "noreply" | "bot" | "passed";
  auto_tags?: string[];
}

/* ── Free email domains (skip domain-based detection for these) ── */

const FREE_DOMAINS = new Set([
  "gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "aol.com",
  "icloud.com", "mail.com", "protonmail.com", "zoho.com", "yandex.com",
  "live.com", "msn.com", "comcast.net", "att.net", "verizon.net",
]);

/* ── Known bulk mailer X-Mailer values ── */

const BULK_MAILERS = [
  "mailchimp", "sendgrid", "constant contact", "hubspot", "mailgun",
  "mandrill", "sendinblue", "brevo", "campaign monitor", "klaviyo",
  "marketo", "pardot", "activecampaign", "drip", "convertkit",
  "mailerlite", "aweber", "getresponse", "postmark",
];

/* ── Noreply patterns ── */

const NOREPLY_PATTERNS = [
  /^no[-_.]?reply@/i,
  /^do[-_.]?not[-_.]?reply@/i,
  /^notifications?@/i,
  /^alerts?@/i,
  /^mailer[-_.]?daemon@/i,
  /^postmaster@/i,
];

/* ── Gmail Pre-filter ── */

/**
 * Inspect Gmail message headers and body to detect junk BEFORE calling AI.
 *
 * @param headers - Parsed email headers as key-value pairs (case-insensitive keys)
 * @param body - First ~1500 chars of email body
 * @param fromEmail - Sender email address
 * @returns PreFilterResult with action, reason, and category
 */
export function preFilterGmail(
  headers: Record<string, string>,
  body: string,
  fromEmail: string,
): PreFilterResult {
  // Normalize header keys to lowercase for case-insensitive matching
  const h: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    h[key.toLowerCase()] = value;
  }

  // 1. Noreply sender detection
  const emailLower = fromEmail.toLowerCase();
  for (const pattern of NOREPLY_PATTERNS) {
    if (pattern.test(emailLower)) {
      return {
        action: "skip",
        reason: `Sender matches noreply pattern: ${emailLower}`,
        category: "noreply",
        auto_tags: ["automated", "noreply"],
      };
    }
  }

  // 2. Auto-reply detection (most specific — check first)
  if (h["auto-submitted"] && h["auto-submitted"] !== "no") {
    return {
      action: "skip",
      reason: `Auto-Submitted header: ${h["auto-submitted"]}`,
      category: "auto_reply",
      auto_tags: ["auto-reply"],
    };
  }

  if (h["x-auto-reply"] || h["x-autoreply"] || h["x-autorespond"]) {
    return {
      action: "skip",
      reason: "X-Auto-Reply/X-Autoreply/X-Autorespond header present",
      category: "auto_reply",
      auto_tags: ["auto-reply"],
    };
  }

  const subject = (h["subject"] || "").toLowerCase();
  if (
    subject.startsWith("out of office") ||
    subject.startsWith("automatic reply") ||
    subject.startsWith("auto:") ||
    subject.includes("out of office") ||
    subject.includes("away from office") ||
    subject.includes("on vacation")
  ) {
    return {
      action: "skip",
      reason: `Auto-reply detected in subject: "${h["subject"]}"`,
      category: "auto_reply",
      auto_tags: ["auto-reply", "out-of-office"],
    };
  }

  // 3. Newsletter detection (List-Unsubscribe is the gold standard)
  if (h["list-unsubscribe"] || h["list-unsubscribe-post"]) {
    return {
      action: "skip",
      reason: "List-Unsubscribe header present",
      category: "newsletter",
      auto_tags: ["newsletter"],
    };
  }

  if (h["list-id"]) {
    return {
      action: "skip",
      reason: `List-Id header: ${h["list-id"]}`,
      category: "newsletter",
      auto_tags: ["newsletter", "mailing-list"],
    };
  }

  // 4. Marketing/bulk detection
  const precedence = (h["precedence"] || "").toLowerCase();
  if (precedence === "bulk" || precedence === "list" || precedence === "junk") {
    return {
      action: "skip",
      reason: `Precedence header: ${precedence}`,
      category: "marketing",
      auto_tags: ["marketing", "bulk"],
    };
  }

  const xMailer = (h["x-mailer"] || "").toLowerCase();
  if (xMailer) {
    for (const mailer of BULK_MAILERS) {
      if (xMailer.includes(mailer)) {
        return {
          action: "skip",
          reason: `Known bulk mailer X-Mailer: ${h["x-mailer"]}`,
          category: "marketing",
          auto_tags: ["marketing", "bulk-mailer"],
        };
      }
    }
  }

  // Also check X-SES-* headers (Amazon SES = bulk)
  if (h["x-ses-outgoing"] || h["x-sg-id"] || h["x-mailgun-sid"]) {
    // These are delivery service headers — check if combined with other signals
    // By themselves not conclusive, but if no personal indicators exist...
  }

  // 5. Body-based newsletter detection (fallback)
  if (body) {
    const bodyLower = body.toLowerCase();
    const unsubCount =
      (bodyLower.match(/unsubscribe/g) || []).length +
      (bodyLower.match(/opt[ -]?out/g) || []).length +
      (bodyLower.match(/email preferences/g) || []).length;

    // Multiple unsubscribe mentions = almost certainly a newsletter
    if (unsubCount >= 2) {
      return {
        action: "skip",
        reason: `Multiple unsubscribe references found in body (${unsubCount})`,
        category: "newsletter",
        auto_tags: ["newsletter"],
      };
    }
  }

  // 6. Passed — no junk signals detected
  return {
    action: "pass",
    reason: "No pre-filter signals detected",
    category: "passed",
  };
}

/* ── Slack Pre-filter ── */

/**
 * Inspect Slack message metadata to detect bot/automated messages.
 *
 * @param message - Slack message object with subtype, bot_id, text fields
 * @returns PreFilterResult
 */
export function preFilterSlack(
  message: {
    subtype?: string;
    bot_id?: string;
    bot_profile?: { name?: string };
    text?: string;
    username?: string;
  },
): PreFilterResult {
  // Bot messages
  if (message.bot_id || message.subtype === "bot_message") {
    const botName = message.bot_profile?.name || message.username || "unknown bot";
    return {
      action: "skip",
      reason: `Bot message from: ${botName}`,
      category: "bot",
      auto_tags: ["bot", "automated"],
    };
  }

  // Slack system messages (channel join/leave, topic changes, etc.)
  const systemSubtypes = new Set([
    "channel_join", "channel_leave", "channel_topic", "channel_purpose",
    "channel_name", "channel_archive", "channel_unarchive",
    "group_join", "group_leave", "group_topic", "group_purpose",
    "pinned_item", "unpinned_item",
    "me_message", "reminder_add",
  ]);

  if (message.subtype && systemSubtypes.has(message.subtype)) {
    return {
      action: "skip",
      reason: `System message subtype: ${message.subtype}`,
      category: "bot",
      auto_tags: ["system", "automated"],
    };
  }

  return {
    action: "pass",
    reason: "No pre-filter signals detected",
    category: "passed",
  };
}

/* ── Helper: Extract headers from Gmail message payload ── */

/**
 * Parse Gmail API message payload headers into a Record.
 * Gmail returns headers as [{name, value}, ...] — this flattens them.
 */
export function parseGmailHeaders(
  headers: Array<{ name: string; value: string }>,
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const header of headers) {
    result[header.name] = header.value;
  }
  return result;
}
