"use client";
import { useRouter } from "next/navigation";

export function DeletePersonButton({ id, name }: { id: number; name: string }) {
  const router = useRouter();
  return (
    <button
      className="btn !border-[color:var(--danger)] !text-danger"
      onClick={async () => {
        if (!confirm(`Delete ${name} and all of their saved data? This cannot be undone.`)) return;
        await fetch(`/api/people/${id}`, { method: "DELETE" });
        document.cookie = "person=; path=/; max-age=0";
        router.push("/people");
        router.refresh();
      }}
    >
      Delete
    </button>
  );
}
