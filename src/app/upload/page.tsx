import { listUploads } from "@/lib/db/uploads";
import { UploadView } from "@/components/upload/UploadView";

export default function UploadPage() {
  const uploads = listUploads().map((u) => ({ id: u.id, label: u.label, source: u.source, createdAt: u.createdAt, count: u.data.placements.length }));
  return <UploadView uploads={uploads} />;
}
