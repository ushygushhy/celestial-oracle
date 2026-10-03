import Link from "next/link";
import { listReadings } from "@/lib/db/tarot";
import { Frame } from "@/components/ui/Frame";
import { JournalList } from "@/components/tarot/JournalList";

export default function JournalPage() {
  return (
    <div className="mx-auto max-w-4xl">
      <Frame title="Tarot Journal" subtitle="Every reading you have saved, newest first." actions={<Link href="/tarot" className="btn btn-gilt">New reading</Link>}>
        <JournalList readings={listReadings()} />
      </Frame>
    </div>
  );
}
