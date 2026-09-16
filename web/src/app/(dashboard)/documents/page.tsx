import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";

const docTypeLabel: Record<string, string> = {
  ALLOCATION_LETTER: "Allocation Letter",
  APPROVAL_LETTER: "Approval Letter",
  BUILDING_PLAN: "Building Plan",
  SITE_PLAN: "Site Plan",
  INSPECTION_REPORT: "Inspection Report",
  OTHER: "Other",
};

export default async function DocumentsPage() {
  interface DocumentListItem {
    id: string;
    file_name: string;
    document_type: string;
    mime_type: string;
    file_size: number;
    created_at: string;
    plot: { id: string; plot_number: string }[] | null;
  }

  let items: DocumentListItem[] = [];

  try {
    const supabase = await createClient();
    const { data: documents } = await supabase
      .from("documents")
      .select(`
        id, file_name, document_type, mime_type, file_size, created_at,
        plot:plots(id, plot_number)
      `)
      .order("created_at", { ascending: false });

    items = (documents ?? []) as unknown as DocumentListItem[];
  } catch {
    // Render with empty list on database error
  }

  function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Documents</h1>
        <span className="text-sm text-slate-500">{items.length} files</span>
      </div>

      {items.length === 0 ? (
        <Card>
          <CardContent className="text-sm text-slate-600">
            No documents found. Documents are uploaded with approvals and inspections.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {items.map((doc) => (
            <Card key={doc.id}>
              <CardContent className="flex items-center justify-between py-3">
                <div className="text-sm">
                  <p className="font-medium">{doc.file_name}</p>
                  <p className="text-slate-500">
                    {docTypeLabel[doc.document_type] ?? doc.document_type}
                    {doc.plot && doc.plot.length > 0 && <> — Plot {doc.plot[0].plot_number}</>}
                    {" • "}{formatSize(doc.file_size)}
                  </p>
                </div>
                <Badge variant="muted">{doc.mime_type.split("/")[1]?.toUpperCase()}</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
