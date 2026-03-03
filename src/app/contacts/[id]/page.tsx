"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { EntityLinker } from "@/components/EntityLinker";
import { CorrespondenceSection } from "@/components/CorrespondenceSection";
import { ArrowLeft, Save, Building2 } from "lucide-react";
import Link from "next/link";

interface Contact {
  id: string;
  name: string;
  organization: string | null;
  email: string | null;
  phone: string | null;
  title: string | null;
  address: string | null;
  segment: string | null;
  primary_category: string | null;
  subcategory: string | null;
  region: string | null;
  business_type: string | null;
  notes: string | null;
  source: string | null;
}

interface LinkedOrganization {
  organization_id: string;
  role: string | null;
  organizations: { id: string; name: string; org_category: string | null; source_table: string | null };
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
      .from("organization_contacts")
      .select("organization_id, role, organizations(id, name, org_category, source_table)")
      .eq("contact_id", contactId);
    if (orgs) setLinkedOrgs(orgs as unknown as LinkedOrganization[]);
  }, [contactId]);

  useEffect(() => {
    async function load() {
      const { data: c } = await supabase.from("contacts").select("*").eq("id", contactId).single();
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
    await supabase.from("contacts").update({
      name: editData.name,
      organization: editData.organization,
      email: editData.email,
      phone: editData.phone,
      title: editData.title,
      address: editData.address,
      notes: editData.notes,
    }).eq("id", contact.id);
    setContact({ ...contact, ...editData });
    setEditing(false);
    setSaving(false);
  };

  // --- Link / Unlink handlers ---

  const searchOrgs = useCallback(async (q: string) => {
    const { data } = await supabase
      .from("organizations")
      .select("id, name, org_category, source_table")
      .ilike("name", `%${q}%`)
      .limit(10);
    return (data || []).map((o) => ({ id: o.id, label: o.name, sub: o.org_category || undefined }));
  }, []);

  const linkOrg = useCallback(async (orgId: string) => {
    await supabase.from("organization_contacts").insert({ organization_id: orgId, contact_id: contactId });
    await loadLinks();
  }, [contactId, loadLinks]);

  const unlinkOrg = useCallback(async (orgId: string) => {
    await supabase.from("organization_contacts").delete().eq("organization_id", orgId).eq("contact_id", contactId);
    await loadLinks();
  }, [contactId, loadLinks]);

  if (!contact) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-48" />
          <div className="h-64 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl">
      <Button variant="ghost" size="sm" className="mb-4" onClick={() => router.back()}>
        <ArrowLeft className="h-4 w-4 mr-1" /> Back
      </Button>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{contact.name}</h1>
          {contact.organization && (
            <p className="text-sm text-gray-500 mt-0.5">{contact.organization}</p>
          )}
          <div className="flex gap-2 mt-2">
            {contact.primary_category && (
              <Badge className={
                contact.primary_category === "Youth Sports" ? "bg-green-100 text-green-800" :
                contact.primary_category === "MiM" ? "bg-blue-100 text-blue-800" :
                "bg-orange-100 text-orange-800"
              }>
                {contact.primary_category}
              </Badge>
            )}
            {contact.segment && <Badge variant="secondary">{contact.segment}</Badge>}
          </div>
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
                <div><label className="text-xs text-gray-500">Name</label><Input value={editData.name || ""} onChange={(e) => setEditData({ ...editData, name: e.target.value })} /></div>
                <div><label className="text-xs text-gray-500">Organization</label><Input value={editData.organization || ""} onChange={(e) => setEditData({ ...editData, organization: e.target.value })} /></div>
                <div><label className="text-xs text-gray-500">Email</label><Input value={editData.email || ""} onChange={(e) => setEditData({ ...editData, email: e.target.value })} /></div>
                <div><label className="text-xs text-gray-500">Phone</label><Input value={editData.phone || ""} onChange={(e) => setEditData({ ...editData, phone: e.target.value })} /></div>
                <div><label className="text-xs text-gray-500">Title</label><Input value={editData.title || ""} onChange={(e) => setEditData({ ...editData, title: e.target.value })} /></div>
                <div><label className="text-xs text-gray-500">Address</label><Input value={editData.address || ""} onChange={(e) => setEditData({ ...editData, address: e.target.value })} /></div>
              </>
            ) : (
              <>
                <div><span className="text-xs text-gray-500">Organization</span><p className="text-sm">{contact.organization || "—"}</p></div>
                <div><span className="text-xs text-gray-500">Email</span><p className="text-sm">{contact.email || "—"}</p></div>
                <div><span className="text-xs text-gray-500">Phone</span><p className="text-sm">{contact.phone || "—"}</p></div>
                <div><span className="text-xs text-gray-500">Title</span><p className="text-sm">{contact.title || "—"}</p></div>
                <div><span className="text-xs text-gray-500">Address</span><p className="text-sm">{contact.address || "—"}</p></div>
                <div><span className="text-xs text-gray-500">Region</span><p className="text-sm">{contact.region || "—"}</p></div>
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
              sub: lo.organizations.org_category || undefined,
              href: lo.organizations.source_table === "investors"
                ? `/investors/${lo.organizations.id}`
                : `/soccer-orgs/${lo.organizations.id}`,
              role: lo.role,
              linkId: lo.organization_id,
            }))}
            onLink={linkOrg}
            onUnlink={unlinkOrg}
            onSearch={searchOrgs}
            existingIds={new Set(linkedOrgs.map((lo) => lo.organization_id))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
