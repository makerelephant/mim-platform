# Entity Model

## Overview

The In Motion platform uses a multi-schema entity model stored in Supabase (Postgres). Entities live in the `core` schema and are referenced by the `brain` schema via polymorphic `entity_id` fields.

## Entity Types

### Contacts (`core.contacts`)

Individual people the CEO interacts with. Fields include:
- `first_name`, `last_name` — display name
- `email` — primary email address (used for entity resolution during email scanning)
- `phone`, `role`, `notes` — supplementary context

Contacts are resolved automatically during Gmail scanning. When the scanner encounters an unknown sender, it creates a new contact record with the email address and any name extracted from the email headers.

### Organizations (`core.organizations`)

Companies, funds, sports clubs, or other entities. Fields include:
- `name` — organization name
- `domain` — website domain (used for domain-based entity resolution)
- `category` — business taxonomy classification
- `stage` — relationship stage (Prospect, Engaged, Active, Churned)

Organizations are matched during scanning by:
1. **Email direct match** — sender email matches a known contact linked to an org
2. **Email junction match** — sender email found in the contact-organization junction table
3. **Domain fallback** — sender email domain matches an org's domain field
4. **Name mention** — org name found in email subject or body text

### Relationships

Contacts and organizations are linked through junction tables. A contact can belong to multiple organizations. The entity resolver (`entity-dossier.ts`) builds relationship context for the classifier by assembling:
- Recent correspondence history with the entity
- Open tasks and pending actions
- Relationship stage and last contact date
- Prior CEO feedback patterns (via `feedback-engine.ts`)

## Polymorphic Entity References

The `brain` schema uses polymorphic entity references:
- `brain.feed_cards` has `entity_id` + `entity_type` columns
- `brain.activity` has `entity_id` + `entity_type` columns
- `brain.tasks` has `entity_id` + `entity_type` columns

**Critical rule**: Never use PostgREST embedding on polymorphic `entity_id`. Always use `.eq()` filters with separate queries per schema.

## Entity Resolution Flow

During email scanning, entities are resolved in this order:
1. Extract sender/recipient email addresses from message headers
2. Match against `core.contacts` by email
3. Follow contact-to-organization links
4. Fall back to domain matching against `core.organizations`
5. If no match, create a new contact record
6. Build an entity dossier for the primary matched entity
7. Pass dossier context to the classifier for priority and relevance scoring
