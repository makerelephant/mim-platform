"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { EntityLinker } from "@/components/EntityLinker";
import { CorrespondenceSection } from "@/components/CorrespondenceSection";
import { ArrowLeft, Save, Building2 } from "lucide-react";
import Link from "next/link";

interface Contact {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  role: string | null;
  notes: string | null;
  source: string | null;
}

interface LinkedOrganization {
  org_id: string;
  relationship_type: string | null;
  organizations: { id: string; name: string };
}

/** Assemble full name from first + last */
function fullName(c: Contact): string {
  return [c.first_name, c.last_name].filter(Boolean).join(" ") || "(unnamed)";
}

export default function ContactDetail() {
  const params = useParams();
  const router = useRouter();
  const [contact, setContact] = useState<Contact | null>(null);
  const [linkedOrgs, setLinkedOrgs] = useState<LinkedOrganization[]>([]);
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState<Partial<Contact>>({});
  const [saving, setSaving] = useState(false);

  const contactId = params.id as string;

  const loadLinks = useCallback(async () => {
    const { data: orgs } = await supabase
      .schema('core').from("relationships")
      .select("org_id, relationship_type, organizations(id, name)")
      .eq("contact_id", contactId);
    if (orgs) setLinkedOrgs(orgs as unknown as LinkedOrganization[]);
  }, [contactId]);

  useEffect(() => {
    async function load() {
      const { data: c } = await supabase.schema('core').from("contacts").select("*").eq("id", contactId).single();
      if (c) {
        setContact(c);
        setEditData(c);
      }
    }
    load();
    loadLinks();
  }, [contactId, loadLinks]);

  const handleSave = async () => {
    if (!contact) return;
    setSaving(true);
    await supabase.schema('core').from("contacts").update({
      first_name: editData.first_name,
      last_name: editData.last_name,
      email: editData.email,
      phone: editData.phone,
      role: editData.role,
      notes: editData.notes,
    }).eq("id", contact.id);
    setContact({ ...contact, ...editData });
    setEditing(false);
    setSaving(false);
  };

  // --- Link / Unlink handlers ---

  const searchOrgs = useCallback(async (q: string) => {
    const { data } = await supabase
      .schema('core').from("organizations")
      .select("id, name")
      .ilike("name", `%${q}%`)
      .limit(10);
    return (data || []).map((o) => ({ id: o.id, label: o.name }));
  }, []);

  const linkOrg = useCallback(async (orgId: string) => {
    await supabase.schema('core').from("relationships").insert({ org_id: orgId, contact_id: contactId });
    await loadLinks();
  }, [contactId, loadLinks]);

  const unlinkOrg = useCallback(async (orgId: string) => {
    await supabase.schema('core').from("relationships").delete().eq("org_id", orgId).eq("contact_id", contactId);
    await loadLinks();
  }, [contactId, loadLinks]);

  if (!contact) {
    return (
      <div>
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-48" />
          <div className="h-64 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl">
      <Button variant="ghost" size="sm" className="mb-4" onClick={() => router.back()}>
        <ArrowLeft className="h-4 w-4 mr-1" /> Back
      </Button>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{fullName(contact)}</h1>
          {contact.role && (
            <p className="text-sm text-gray-500 mt-0.5">{contact.role}</p>
          )}
        </div>
        <Button variant={editing ? "default" : "outline"} onClick={editing ? handleSave : () => setEditing(true)} disabled={saving}>
          {editing ? <><Save className="h-4 w-4 mr-1" /> Save</> : "Edit"}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Contact Info</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {editing ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-xs text-gray-500">First Name</label><Input value={editData.first_name || ""} onChange={(e) => setEditData({ ...editData, first_name: e.target.value })} /></div>
                  <div><label className="text-xs text-gray-500">Last Name</label><Input value={editData.last_name || ""} onChange={(e) => setEditData({ ...editData, last_name: e.target.value })} /></div>
                </div>
                <div><label className="text-xs text-gray-500">Email</label><Input value={editData.email || ""} onChange={(e) => setEditData({ ...editData, email: e.target.value })} /></div>
                <div><label className="text-xs text-gray-500">Phone</label><Input value={editData.phone || ""} onChange={(e) => setEditData({ ...editData, phone: e.target.value })} /></div>
                <div><label className="text-xs text-gray-500">Role / Title</label><Input value={editData.role || ""} onChange={(e) => setEditData({ ...editData, role: e.target.value })} /></div>
              </>
            ) : (
              <>
                <div><span className="text-xs text-gray-500">Email</span><p className="text-sm">{contact.email || "—"}</p></div>
                <div><span className="text-xs text-gray-500">Phone</span><p className="text-sm">{contact.phone || "—"}</p></div>
                <div><span className="text-xs text-gray-500">Role / Title</span><p className="text-sm">{contact.role || "—"}</p></div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Notes</CardTitle></CardHeader>
          <CardContent>
            {editing ? (
              <Textarea rows={6} value={editData.notes || ""} onChange={(e) => setEditData({ ...editData, notes: e.target.value })} />
            ) : (
              <p className="text-sm text-gray-600 whitespace-pre-wrap">{contact.notes || "No notes yet."}</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-6">
        <CorrespondenceSection entityType="contacts" entityId={contactId} />
      </div>

      <Card className="mt-6">
        <CardContent className="pt-5">
          <EntityLinker
            title="Organizations"
            icon={<Building2 className="h-4 w-4" />}
            items={linkedOrgs.map((lo) => ({
              id: lo.organizations.id,
              label: lo.organizations.name,
              href: `/all-orgs/${lo.organizations.id}`,
              role: lo.relationship_type,
              linkId: lo.org_id,
            }))}
            onLink={linkOrg}
            onUnlink={unlinkOrg}
            onSearch={searchOrgs}
            existingIds={new Set(linkedOrgs.map((lo) => lo.org_id))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
