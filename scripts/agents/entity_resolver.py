"""
Entity Resolver — routes email addresses to the correct MiM entity.

Given an email address, resolves which contacts, investors, and/or communities
are associated with it through direct email matches and junction table lookups.

Usage:
    from entity_resolver import EntityResolver

    resolver = EntityResolver(supabase_client)
    matches = resolver.resolve("john@xyzfund.com")
    # [EntityMatch(entity_type="contacts", entity_id="...", entity_name="John Doe", ...),
    #  EntityMatch(entity_type="investors", entity_id="...", entity_name="XYZ Fund", ...)]
"""

from dataclasses import dataclass, field
from typing import Optional
from urllib.parse import urlparse

from supabase import Client


@dataclass
class EntityMatch:
    entity_type: str         # "contacts", "investors", "soccer_orgs"
    entity_id: str
    entity_name: str
    match_method: str        # "email_direct", "email_junction", "domain_fallback"
    confidence: float = 1.0  # 0.0 - 1.0


class EntityResolver:
    """Builds an in-memory lookup index from all entity tables and junctions."""

    def __init__(self, sb: Client):
        self.sb = sb

        # Email -> contact mapping
        self.email_to_contacts: dict[str, dict] = {}

        # Contact -> linked entities
        self.contact_to_investors: dict[str, list[dict]] = {}
        self.contact_to_orgs: dict[str, list[dict]] = {}

        # Domain -> entity mapping (fallback)
        self.domain_to_investors: dict[str, dict] = {}
        self.domain_to_orgs: dict[str, dict] = {}

        self._load()

    def _load(self):
        """Load all entity data into memory for fast lookups."""
        print("  [EntityResolver] Loading entity data...")

        # 1. Load contacts with primary emails
        contacts = self.sb.table("contacts").select("id, name, email, organization").execute()
        for c in contacts.data:
            if c.get("email"):
                self.email_to_contacts[c["email"].lower().strip()] = {
                    "id": c["id"], "name": c["name"], "organization": c.get("organization"),
                }

        # 2. Load contact_emails junction for multi-email support
        contact_emails = self.sb.table("contact_emails").select("contact_id, email").execute()
        for ce in contact_emails.data:
            email_lower = ce["email"].lower().strip()
            if email_lower not in self.email_to_contacts:
                # Look up the contact record
                contact_match = next(
                    (c for c in contacts.data if c["id"] == ce["contact_id"]), None
                )
                if contact_match:
                    self.email_to_contacts[email_lower] = {
                        "id": contact_match["id"],
                        "name": contact_match["name"],
                        "organization": contact_match.get("organization"),
                    }

        # 3. Load investor_contacts junction
        inv_contacts = self.sb.table("investor_contacts").select(
            "contact_id, investor_id, investors(id, firm_name)"
        ).execute()
        for ic in inv_contacts.data:
            cid = ic["contact_id"]
            inv = ic.get("investors")
            if inv:
                self.contact_to_investors.setdefault(cid, []).append({
                    "id": inv["id"], "name": inv["firm_name"],
                })

        # 4. Load soccer_org_contacts junction
        org_contacts = self.sb.table("soccer_org_contacts").select(
            "contact_id, soccer_org_id, soccer_orgs(id, org_name)"
        ).execute()
        for oc in org_contacts.data:
            cid = oc["contact_id"]
            org = oc.get("soccer_orgs")
            if org:
                self.contact_to_orgs.setdefault(cid, []).append({
                    "id": org["id"], "name": org["org_name"],
                })

        # 5. Build domain -> investor mapping from websites
        investors = self.sb.table("investors").select("id, firm_name, website").not_.is_("website", "null").execute()
        for inv in investors.data:
            domain = self._extract_domain(inv.get("website", ""))
            if domain:
                self.domain_to_investors[domain] = {"id": inv["id"], "name": inv["firm_name"]}

        # 6. Build domain -> soccer_org mapping from websites
        orgs = self.sb.table("soccer_orgs").select("id, org_name, website").not_.is_("website", "null").execute()
        for org in orgs.data:
            domain = self._extract_domain(org.get("website", ""))
            if domain:
                self.domain_to_orgs[domain] = {"id": org["id"], "name": org["org_name"]}

        print(f"  [EntityResolver] Loaded: {len(self.email_to_contacts)} emails, "
              f"{sum(len(v) for v in self.contact_to_investors.values())} investor links, "
              f"{sum(len(v) for v in self.contact_to_orgs.values())} org links, "
              f"{len(self.domain_to_investors)} investor domains, "
              f"{len(self.domain_to_orgs)} org domains")

    @staticmethod
    def _extract_domain(url: str) -> Optional[str]:
        """Extract base domain from a URL or website string."""
        if not url:
            return None
        url = url.strip().lower()
        if not url.startswith("http"):
            url = "https://" + url
        try:
            parsed = urlparse(url)
            domain = parsed.hostname or ""
            # Strip www. prefix
            if domain.startswith("www."):
                domain = domain[4:]
            return domain if domain else None
        except Exception:
            return None

    @staticmethod
    def _extract_email_domain(email: str) -> Optional[str]:
        """Extract domain from an email address."""
        if "@" not in email:
            return None
        domain = email.split("@")[1].lower().strip()
        # Skip common free email providers (not useful for entity matching)
        free_domains = {
            "gmail.com", "yahoo.com", "outlook.com", "hotmail.com",
            "aol.com", "icloud.com", "me.com", "live.com", "msn.com",
            "protonmail.com", "mail.com", "comcast.net", "verizon.net",
        }
        if domain in free_domains:
            return None
        return domain

    def resolve(self, email: str) -> list[EntityMatch]:
        """
        Resolve an email address to matching entities.

        Returns a list of EntityMatch objects, potentially spanning multiple
        entity types (a contact who is linked to an investor and a community
        would return all three matches).
        """
        email = email.lower().strip()
        matches: list[EntityMatch] = []
        seen: set[tuple[str, str]] = set()

        # Step 1: Direct email match -> contact
        contact = self.email_to_contacts.get(email)
        if contact:
            key = ("contacts", contact["id"])
            if key not in seen:
                seen.add(key)
                matches.append(EntityMatch(
                    entity_type="contacts",
                    entity_id=contact["id"],
                    entity_name=contact["name"],
                    match_method="email_direct",
                    confidence=1.0,
                ))

            # Step 2: Contact -> linked investors
            linked_investors = self.contact_to_investors.get(contact["id"], [])
            for inv in linked_investors:
                key = ("investors", inv["id"])
                if key not in seen:
                    seen.add(key)
                    matches.append(EntityMatch(
                        entity_type="investors",
                        entity_id=inv["id"],
                        entity_name=inv["name"],
                        match_method="email_junction",
                        confidence=0.9,
                    ))

            # Step 3: Contact -> linked communities
            linked_orgs = self.contact_to_orgs.get(contact["id"], [])
            for org in linked_orgs:
                key = ("soccer_orgs", org["id"])
                if key not in seen:
                    seen.add(key)
                    matches.append(EntityMatch(
                        entity_type="soccer_orgs",
                        entity_id=org["id"],
                        entity_name=org["name"],
                        match_method="email_junction",
                        confidence=0.9,
                    ))

        # Step 4: Domain fallback (only if no direct match)
        if not matches:
            domain = self._extract_email_domain(email)
            if domain:
                # Check investor domains
                inv = self.domain_to_investors.get(domain)
                if inv:
                    key = ("investors", inv["id"])
                    if key not in seen:
                        seen.add(key)
                        matches.append(EntityMatch(
                            entity_type="investors",
                            entity_id=inv["id"],
                            entity_name=inv["name"],
                            match_method="domain_fallback",
                            confidence=0.6,
                        ))

                # Check org domains
                org = self.domain_to_orgs.get(domain)
                if org:
                    key = ("soccer_orgs", org["id"])
                    if key not in seen:
                        seen.add(key)
                        matches.append(EntityMatch(
                            entity_type="soccer_orgs",
                            entity_id=org["id"],
                            entity_name=org["name"],
                            match_method="domain_fallback",
                            confidence=0.6,
                        ))

        return matches

    def resolve_multiple(self, emails: list[str]) -> list[EntityMatch]:
        """Resolve multiple email addresses and return deduplicated matches."""
        all_matches: list[EntityMatch] = []
        seen: set[tuple[str, str]] = set()

        for email in emails:
            for match in self.resolve(email):
                key = (match.entity_type, match.entity_id)
                if key not in seen:
                    seen.add(key)
                    all_matches.append(match)

        return all_matches
