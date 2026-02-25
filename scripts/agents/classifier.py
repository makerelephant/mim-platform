"""
Message Classifier — uses Claude to classify emails/messages and extract tasks.

Takes raw message content + resolved entity matches from EntityResolver,
returns structured classification with entity routing and prioritized action items.

Usage:
    from classifier import MessageClassifier

    classifier = MessageClassifier(anthropic_client)
    result = classifier.classify(
        message={"subject": "...", "body": "...", "from": "..."},
        resolved_entities=[EntityMatch(...)],
        source_type="email"
    )
"""

import json
from dataclasses import dataclass, field
from typing import Optional

from entity_resolver import EntityMatch


@dataclass
class ActionItem:
    title: str
    summary: Optional[str] = None            # Context: "what is happening"
    recommended_action: Optional[str] = None  # Action: "what to do about it"
    priority: str = "medium"  # low, medium, high, critical
    due_date: Optional[str] = None
    goal_relevance_score: Optional[int] = None  # 1-10 relevance to 90-day goals
    description: Optional[str] = None  # legacy compat


@dataclass
class ClassificationResult:
    primary_silo: str               # "investors", "soccer_orgs", "contacts"
    primary_entity_id: Optional[str]
    primary_entity_name: Optional[str]
    summary: str                     # One-line summary of the message
    action_items: list[ActionItem] = field(default_factory=list)
    tags: list[str] = field(default_factory=list)
    sentiment: str = "neutral"       # positive, neutral, negative, urgent


SYSTEM_PROMPT = """You are an AI assistant that classifies business communications for a sports merchandise company called Made in Motion (MiM).

MiM works with three main entity types:
1. **Investors** — venture capital firms, angel investors, seed funds. Communications about fundraising, cap tables, term sheets, due diligence, pitch decks, portfolio updates, financial projections.
2. **Communities (soccer_orgs)** — youth soccer organizations, clubs, leagues in Massachusetts. Communications about partnerships, merchandise, tournaments, player registrations, outreach, sponsorships, uniforms, team stores.
3. **Contacts** — general contacts, networking, personal relationships that don't clearly fit investors or communities.

You will receive:
- The message content (subject, body, sender)
- A list of resolved entities that the sender/recipients match to in our database

Your job:
1. **Classify** which silo this message primarily belongs to (investors, soccer_orgs, or contacts)
2. **Pick the primary entity** from the resolved list (or null if none match well)
3. **Summarize** the message in one concise line
4. **Extract action items** with appropriate priorities:
   - critical: urgent deadlines, legal issues, compliance, time-sensitive investor requests
   - high: meeting requests, term sheet discussions, partnership proposals, investor follow-ups, deal updates
   - medium: general follow-ups, status updates, introductions, scheduling
   - low: newsletters, FYI emails, automated notifications, mass emails
5. **Tag** the message with relevant categories

Respond with ONLY a JSON object in this exact format:
{
  "primary_silo": "investors" | "soccer_orgs" | "contacts",
  "primary_entity_id": "uuid-string" | null,
  "primary_entity_name": "Entity Name" | null,
  "summary": "One-line summary",
  "sentiment": "positive" | "neutral" | "negative" | "urgent",
  "action_items": [
    {
      "title": "Clear, actionable task title",
      "summary": "Context about what is happening — the situation, background, or trigger",
      "recommended_action": "Specific recommended next step — what the user should do",
      "priority": "low" | "medium" | "high" | "critical",
      "due_date": "YYYY-MM-DD" | null,
      "goal_relevance_score": 1-10 | null
    }
  ],
  "tags": ["follow-up", "meeting-request", "deal-update", "partnership", "intro-request", "merch", "newsletter", etc.]
}

IMPORTANT:
- If there are no action items, return an empty array []
- Task titles should be actionable and specific, like "Follow up with Greenhill Capital re: Series A timeline" not just "follow up"
- Only extract genuine action items that require the user to do something
- Skip automated notifications, marketing emails, and spam
- If the email is clearly automated/newsletter, set primary_silo to "contacts" and return no action items

For each action item, separate CONTEXT from ACTION:
- "summary" = the background/situation (e.g., "Greenhill Capital requested updated financial projections for Q1 due diligence")
- "recommended_action" = what to do about it (e.g., "Prepare and send updated Q1 financial projections spreadsheet to Jane at Greenhill")
- "goal_relevance_score" = how relevant this is to the company's 90-day strategic goals (1=tangential, 5=moderately relevant, 10=directly critical to fundraising/partnerships). Only set this if you can reasonably infer relevance."""


class MessageClassifier:
    """Classifies messages using Claude and extracts action items."""

    MODEL = "claude-sonnet-4-5-20250929"
    MAX_TOKENS = 1200

    def __init__(self, anthropic_client):
        self.client = anthropic_client

    def classify(self, message: dict, resolved_entities: list[EntityMatch],
                 source_type: str = "email") -> ClassificationResult:
        """
        Classify a message and extract action items.

        Args:
            message: dict with keys like "subject", "body", "from" (email) or "text", "user" (slack)
            resolved_entities: list of EntityMatch from EntityResolver
            source_type: "email" or "slack"

        Returns:
            ClassificationResult with routing, summary, and action items
        """
        # Build the entity context for Claude
        entity_context = ""
        if resolved_entities:
            entity_lines = []
            for em in resolved_entities:
                entity_lines.append(
                    f"  - [{em.entity_type}] {em.entity_name} (id: {em.entity_id}, "
                    f"matched via: {em.match_method}, confidence: {em.confidence})"
                )
            entity_context = "Resolved entities from our database:\n" + "\n".join(entity_lines)
        else:
            entity_context = "No matching entities found in our database for the sender/recipients."

        # Build the message content for Claude
        if source_type == "email":
            msg_content = (
                f"Source: Email\n"
                f"From: {message.get('from', 'unknown')}\n"
                f"Subject: {message.get('subject', '(no subject)')}\n"
                f"Body:\n{message.get('body', '')[:1500]}"
            )
        else:  # slack
            msg_content = (
                f"Source: Slack message\n"
                f"Channel: {message.get('channel', 'unknown')}\n"
                f"User: {message.get('user', 'unknown')}\n"
                f"Message:\n{message.get('text', '')[:1500]}"
            )

        user_prompt = f"{entity_context}\n\n---\n\n{msg_content}"

        try:
            response = self.client.messages.create(
                model=self.MODEL,
                max_tokens=self.MAX_TOKENS,
                system=SYSTEM_PROMPT,
                messages=[{"role": "user", "content": user_prompt}],
            )

            text = response.content[0].text.strip()

            # Parse JSON — handle potential markdown code fences
            if text.startswith("```"):
                text = text.split("```")[1]
                if text.startswith("json"):
                    text = text[4:]
                text = text.strip()

            data = json.loads(text)

            # Build action items
            action_items = []
            for ai in data.get("action_items", []):
                # Parse goal_relevance_score safely
                grs = ai.get("goal_relevance_score")
                if grs is not None:
                    try:
                        grs = max(1, min(10, int(grs)))
                    except (ValueError, TypeError):
                        grs = None

                action_items.append(ActionItem(
                    title=ai.get("title", "Untitled task"),
                    summary=ai.get("summary"),
                    recommended_action=ai.get("recommended_action"),
                    priority=ai.get("priority", "medium"),
                    due_date=ai.get("due_date"),
                    goal_relevance_score=grs,
                    description=ai.get("description"),  # legacy compat
                ))

            return ClassificationResult(
                primary_silo=data.get("primary_silo", "contacts"),
                primary_entity_id=data.get("primary_entity_id"),
                primary_entity_name=data.get("primary_entity_name"),
                summary=data.get("summary", "Message processed"),
                action_items=action_items,
                tags=data.get("tags", []),
                sentiment=data.get("sentiment", "neutral"),
            )

        except json.JSONDecodeError as e:
            print(f"  [Classifier] JSON parse error: {e}")
            return self._fallback_result(message, resolved_entities, source_type)
        except Exception as e:
            print(f"  [Classifier] Error: {e}")
            return self._fallback_result(message, resolved_entities, source_type)

    def _fallback_result(self, message: dict, resolved_entities: list[EntityMatch],
                         source_type: str) -> ClassificationResult:
        """Return a basic classification when Claude call fails."""
        # Pick the highest-confidence entity from resolved matches
        primary_silo = "contacts"
        primary_id = None
        primary_name = None

        if resolved_entities:
            # Prefer investor > soccer_org > contact ordering for fallback
            for pref_type in ["investors", "soccer_orgs", "contacts"]:
                match = next((e for e in resolved_entities if e.entity_type == pref_type), None)
                if match:
                    primary_silo = match.entity_type
                    primary_id = match.entity_id
                    primary_name = match.entity_name
                    break

        subject = message.get("subject", message.get("text", ""))[:80]

        return ClassificationResult(
            primary_silo=primary_silo,
            primary_entity_id=primary_id,
            primary_entity_name=primary_name,
            summary=f"{'Email' if source_type == 'email' else 'Slack message'}: {subject}",
            action_items=[],
            tags=["unclassified"],
            sentiment="neutral",
        )
