"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Markdown } from "../ui/Markdown";
import { Sunburst, Sparkle, FrameCorners } from "../ui/Ornaments";

interface PersonLite { id: number; name: string }
interface ThreadSummary { id: number; personId: number | null; personName: string | null; title: string; updatedAt: string }
interface Item {
  role: "user" | "assistant" | "context";
  text: string;
  images?: string[];
  files?: string[];
  tools?: { label: string; done: boolean; error?: boolean }[];
  notices?: string[];
  streaming?: boolean;
  error?: string;
}
interface PendingAttachment { kind: "image" | "pdf"; mediaType: string; data: string; name: string; preview?: string }

export interface OracleAskDetail { text: string; personId?: number | null }

const SUGGESTIONS_PERSON = [
  "What are the most important transits for me right now, and when do they peak?",
  "Tell me about my chart ruler and where it sits.",
  "When does Saturn next make a hard aspect to my Sun or Moon?",
  "What does this profection year emphasise for me?",
];
const SUGGESTIONS_GENERAL = [
  "What's happening in the sky this week?",
  "When is the next Mercury retrograde?",
  "Explain the difference between Placidus and Whole Sign houses.",
  "What does the Tower card mean reversed?",
];

const MAX_EDGE = 1568;

async function fileToAttachment(file: File): Promise<PendingAttachment> {
  if (file.type === "application/pdf") {
    if (file.size > 20 * 1024 * 1024) throw new Error(`${file.name} is larger than 20 MB`);
    const data = await readBase64(file);
    return { kind: "pdf", mediaType: "application/pdf", data, name: file.name };
  }
  if (!file.type.startsWith("image/")) throw new Error(`${file.name}: only images and PDFs can be attached`);
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const keepOriginal = scale === 1 && file.size < 3.5 * 1024 * 1024 && ["image/png", "image/jpeg", "image/webp", "image/gif"].includes(file.type);
  if (keepOriginal) {
    const data = await readBase64(file);
    return { kind: "image", mediaType: file.type, data, name: file.name, preview: `data:${file.type};base64,${data}` };
  }
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const url = canvas.toDataURL("image/jpeg", 0.92);
  return { kind: "image", mediaType: "image/jpeg", data: url.split(",")[1], name: file.name, preview: url };
}

function readBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1]);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

export function OracleChat({ people, activePersonId }: { people: PersonLite[]; activePersonId: number | null }) {
  const pathname = usePathname();
  const fromPath = /^\/(?:chart|transits|year)\/(\d+)/.exec(pathname)?.[1];
  const pagePerson = fromPath ? Number(fromPath) : activePersonId;

  const [open, setOpen] = useState(false);
  const [personId, setPersonId] = useState<number | null>(pagePerson && people.some((p) => p.id === pagePerson) ? pagePerson : null);
  const [threadId, setThreadId] = useState<number | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [configured, setConfigured] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [deep, setDeep] = useState(false);
  const [sending, setSending] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [attachError, setAttachError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const loadedFor = useRef<string>("");

  const refreshThreads = useCallback(async () => {
    const res = await fetch("/api/chat/threads");
    const d = await res.json();
    setThreads(d.threads ?? []);
    setConfigured(d.configured !== false);
    return (d.threads ?? []) as ThreadSummary[];
  }, []);

  const loadThread = useCallback(async (id: number) => {
    const res = await fetch(`/api/chat/threads/${id}`);
    if (!res.ok) return;
    const d = await res.json();
    setThreadId(id);
    setPersonId(d.thread.personId);
    setItems((d.items as Item[]).map((it) => ({ ...it, tools: (it.tools as unknown as string[] | undefined)?.map((label) => ({ label, done: true })) })));
    setShowHistory(false);
  }, []);

  const newConversation = useCallback((pid: number | null) => {
    abortRef.current?.abort();
    setThreadId(null);
    setItems([]);
    setPersonId(pid);
    setShowHistory(false);
  }, []);

  // On open: resume the latest conversation for the current person, if any.
  useEffect(() => {
    if (!open) return;
    const key = `${personId ?? "none"}`;
    if (loadedFor.current === key) return;
    loadedFor.current = key;
    refreshThreads().then((list) => {
      const latest = list.find((t) => t.personId === personId);
      if (latest && !threadId) loadThread(latest.id);
    });
  }, [open, personId, refreshThreads, loadThread, threadId]);

  // "Ask in chat" from interpretation panels and elsewhere.
  useEffect(() => {
    const onAsk = (e: Event) => {
      const d = (e as CustomEvent<OracleAskDetail>).detail;
      setOpen(true);
      if (d.personId !== undefined && d.personId !== personId) {
        loadedFor.current = `${d.personId ?? "none"}`;
        newConversation(d.personId);
      }
      setInput(d.text);
      setTimeout(() => inputRef.current?.focus(), 50);
    };
    window.addEventListener("oracle:ask", onAsk);
    return () => window.removeEventListener("oracle:ask", onAsk);
  }, [personId, newConversation]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [items]);

  const addFiles = async (files: FileList | File[]) => {
    setAttachError(null);
    for (const f of Array.from(files).slice(0, 6 - attachments.length)) {
      try {
        const a = await fileToAttachment(f);
        setAttachments((prev) => [...prev, a]);
      } catch (e) {
        setAttachError((e as Error).message);
      }
    }
  };

  const updateLast = (fn: (it: Item) => Item) =>
    setItems((prev) => {
      const next = [...prev];
      next[next.length - 1] = fn(next[next.length - 1]);
      return next;
    });

  const send = async (textOverride?: string) => {
    const text = (textOverride ?? input).trim();
    if ((!text && attachments.length === 0) || sending) return;
    const sentAttachments = attachments;
    setInput("");
    setAttachments([]);
    setSending(true);
    setItems((prev) => [
      ...prev,
      { role: "user", text, images: sentAttachments.filter((a) => a.preview).map((a) => a.preview!), files: sentAttachments.filter((a) => a.kind === "pdf").map((a) => a.name) },
      { role: "assistant", text: "", tools: [], notices: [], streaming: true },
    ]);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: ctrl.signal,
        body: JSON.stringify({
          threadId,
          personId,
          text,
          depth: deep ? "deep" : "standard",
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          attachments: sentAttachments.map(({ kind, mediaType, data, name }) => ({ kind, mediaType, data, name })),
        }),
      });
      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        updateLast((it) => ({ ...it, streaming: false, error: err.error ?? "Request failed" }));
        return;
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (!line) continue;
          const ev = JSON.parse(line);
          switch (ev.type) {
            case "thread":
              setThreadId(ev.id);
              refreshThreads();
              break;
            case "text":
              updateLast((it) => ({ ...it, text: it.text + ev.text }));
              break;
            case "tool":
              updateLast((it) => ({ ...it, tools: [...(it.tools ?? []), { label: `Calculating: ${ev.label}…`, done: false }] }));
              break;
            case "tool_done":
              updateLast((it) => {
                const tools = [...(it.tools ?? [])];
                const idx = tools.findIndex((t) => !t.done);
                if (idx >= 0) tools[idx] = { label: ev.label, done: true, error: ev.error };
                return { ...it, tools };
              });
              break;
            case "notice":
              updateLast((it) => ({ ...it, notices: [...(it.notices ?? []), ev.text] }));
              break;
            case "error":
              updateLast((it) => ({ ...it, error: ev.message }));
              break;
            case "done":
              updateLast((it) => ({ ...it, streaming: false }));
              break;
          }
        }
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") updateLast((it) => ({ ...it, error: (e as Error).message }));
      else updateLast((it) => ({ ...it, notices: [...(it.notices ?? []), "Stopped."] }));
    } finally {
      updateLast((it) => ({ ...it, streaming: false }));
      setSending(false);
      abortRef.current = null;
    }
  };

  const personName = people.find((p) => p.id === personId)?.name;
  const suggestions = personId ? SUGGESTIONS_PERSON : SUGGESTIONS_GENERAL;

  return (
    <>
      {!open && (
        <button
          onClick={() => {
            // Follow the page: opening on another person's chart switches the conversation to them.
            const target = pagePerson && people.some((p) => p.id === pagePerson) ? pagePerson : personId;
            if (target !== personId) {
              loadedFor.current = "";
              newConversation(target);
            }
            setOpen(true);
          }}
          className="btn btn-gilt fixed bottom-5 right-5 z-40 !rounded-full !px-5 !py-3 shadow-[var(--shadow-card)]"
          aria-label="Ask the Oracle"
        >
          <Sparkle size={12} /> Ask the Oracle
        </button>
      )}

      {open && (
        <aside
          className="frame-gilt fixed bottom-3 right-3 top-3 z-50 flex w-[min(540px,calc(100vw-1.5rem))] flex-col !bg-surface-strong"
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={(e) => { if (e.currentTarget === e.target) setDragging(false); }}
          onDrop={(e) => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files); }}
        >
          <FrameCorners />
          {/* Header */}
          <header className="border-b border-rule px-4 pb-3 pt-3.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <Sunburst size={30} className="text-accent" />
                <div>
                  <h2 className="engraved text-base leading-none text-accent-bright">The Oracle</h2>
                  <p className="headline-italic mt-0.5 text-xs font-normal text-muted">Answers from the ephemeris, never from guesswork</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button className="btn px-2.5 py-1 text-[0.62rem]" onClick={() => { setShowHistory((s) => !s); refreshThreads(); }}>History</button>
                <button className="btn px-2.5 py-1 text-[0.62rem]" onClick={() => newConversation(personId)}>New</button>
                <button className="btn px-2.5 py-1" onClick={() => setOpen(false)} aria-label="Close chat">✕</button>
              </div>
            </div>
            <label className="mt-2.5 flex items-center gap-2 text-sm">
              <span className="engraved text-[0.6rem] text-faint">About</span>
              <select
                className="field flex-1 py-1 text-sm"
                value={personId ?? ""}
                onChange={(e) => {
                  const pid = e.target.value ? Number(e.target.value) : null;
                  loadedFor.current = `${pid ?? "none"}`;
                  newConversation(pid);
                }}
              >
                <option value="">No one in particular (general questions)</option>
                {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
            {personId && <p className="mt-1.5 text-[0.7rem] text-faint">Includes {personName}&apos;s full natal chart, today&apos;s transits, progressions, profection year and numerology. It can also calculate any date.</p>}
          </header>

          {/* History */}
          {showHistory && (
            <div className="max-h-72 overflow-y-auto border-b border-rule bg-surface-sunken px-2 py-2">
              {threads.length === 0 && <p className="px-2 py-2 text-sm italic text-muted">No saved conversations yet.</p>}
              {threads.map((t) => (
                <div key={t.id} className={`group flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-[rgb(204_168_116/0.08)] ${t.id === threadId ? "text-accent-bright" : ""}`}>
                  <button className="min-w-0 flex-1 text-left" onClick={() => loadThread(t.id)}>
                    <span className="block truncate">{t.title}</span>
                    <span className="text-[0.68rem] text-faint">{t.personName ?? "General"} · {t.updatedAt.slice(0, 16).replace("T", " ")}</span>
                  </button>
                  <button
                    className="text-xs text-faint opacity-0 hover:text-danger group-hover:opacity-100"
                    title="Delete conversation"
                    onClick={async () => {
                      if (!confirm("Delete this conversation?")) return;
                      await fetch(`/api/chat/threads/${t.id}`, { method: "DELETE" });
                      if (t.id === threadId) newConversation(personId);
                      refreshThreads();
                    }}
                  >
                    delete
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Messages */}
          <div ref={listRef} className="relative flex-1 space-y-4 overflow-y-auto px-4 py-4">
            {!configured && (
              <div className="panel border-danger px-3 py-2.5 text-sm">
                <b className="text-danger">The Oracle needs an API key.</b>
                <p className="mt-1 text-muted">Create <code className="text-accent-bright">celestial-oracle/.env.local</code> containing <code className="text-accent-bright">ANTHROPIC_API_KEY=sk-ant-…</code>, then stop and restart <code>npm run dev</code>.</p>
              </div>
            )}
            {items.length === 0 && (
              <div className="flex flex-col items-center gap-3 pt-6 text-center">
                <Sunburst size={64} className="text-accent" />
                <p className="headline-italic text-sm font-normal text-muted">{personName ? `Ask anything about ${personName}'s chart, timing, cards or numbers.` : "Ask about astrology, the sky, tarot or numerology."}</p>
                <div className="mt-2 grid w-full gap-2">
                  {suggestions.map((s) => (
                    <button key={s} className="panel px-3 py-2 text-left text-sm text-muted transition hover:text-text" onClick={() => send(s)} disabled={sending}>
                      {s}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-xs text-faint">Tip: drop a screenshot of any chart here to have it read.</p>
              </div>
            )}
            {items.map((it, i) =>
              it.role === "context" ? (
                <p key={i} className="text-center text-[0.68rem] italic text-faint">✦ {it.text}</p>
              ) : it.role === "user" ? (
                <div key={i} className="ml-10 rounded-sm border border-rule bg-[rgb(204_168_116/0.08)] px-3 py-2 text-[0.95rem]">
                  {it.images && it.images.length > 0 && (
                    <div className="mb-2 flex flex-wrap gap-2">
                      {/* eslint-disable-next-line @next/next/no-img-element -- in-memory data: URL previews */}
                      {it.images.map((src, k) => <img key={k} src={src} alt="attachment" className="max-h-40 rounded-sm border border-rule" />)}
                    </div>
                  )}
                  {it.files?.map((f) => <p key={f} className="mb-1 text-xs text-muted">📄 {f}</p>)}
                  <p className="whitespace-pre-wrap">{it.text}</p>
                </div>
              ) : (
                <div key={i} className="mr-4">
                  {it.tools && it.tools.length > 0 && (
                    <div className="mb-2 flex flex-wrap gap-1.5">
                      {it.tools.map((t, k) => (
                        <span key={k} className={`chip !text-[0.7rem] ${t.error ? "!border-[color:var(--danger)] text-danger" : t.done ? "" : "animate-pulse"}`}>
                          <Sparkle size={7} /> {t.label}
                        </span>
                      ))}
                    </div>
                  )}
                  {it.text ? <Markdown text={it.text} className="text-[0.97rem]" /> : it.streaming && !it.error ? (
                    <div className="flex items-center gap-2 text-sm text-muted">
                      <Sunburst size={22} className="animate-[spin_10s_linear_infinite] text-accent" /> <span className="headline-italic font-normal">Consulting the ephemeris…</span>
                    </div>
                  ) : null}
                  {it.streaming && it.text && <span className="inline-block h-4 w-1.5 animate-pulse bg-accent align-middle" />}
                  {it.notices?.map((n, k) => <p key={k} className="mt-1 text-xs italic text-faint">{n}</p>)}
                  {it.error && <p className="mt-1 text-sm text-danger">{it.error}</p>}
                </div>
              ),
            )}
            {dragging && (
              <div className="pointer-events-none absolute inset-2 flex items-center justify-center rounded-sm border-2 border-dashed border-[color:var(--rule-strong)] bg-[rgb(9_18_24/0.7)]">
                <p className="engraved text-sm text-accent-bright">Drop chart images or PDFs</p>
              </div>
            )}
          </div>

          {/* Composer */}
          <footer className="border-t border-rule px-3 pb-3 pt-2.5">
            {attachments.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-2">
                {attachments.map((a, k) => (
                  <div key={k} className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element -- in-memory data: URL previews */}
                    {a.preview ? <img src={a.preview} alt={a.name} className="h-14 w-14 rounded-sm border border-rule object-cover" /> : <span className="chip">📄 {a.name}</span>}
                    <button className="absolute -right-1.5 -top-1.5 h-5 w-5 rounded-full bg-surface-strong text-xs text-danger shadow" onClick={() => setAttachments((prev) => prev.filter((_, j) => j !== k))} aria-label="Remove attachment">×</button>
                  </div>
                ))}
              </div>
            )}
            {attachError && <p className="mb-1 text-xs text-danger">{attachError}</p>}
            <textarea
              ref={inputRef}
              className="field min-h-[3.2rem] resize-none text-[0.95rem]"
              rows={Math.min(6, Math.max(2, input.split("\n").length))}
              placeholder={personName ? `Ask about ${personName}… (Enter to send, Shift+Enter for a new line)` : "Ask the Oracle… (Enter to send)"}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onPaste={(e) => {
                const files = Array.from(e.clipboardData.files);
                if (files.length) { e.preventDefault(); addFiles(files); }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); }
              }}
            />
            <div className="mt-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <label className="btn cursor-pointer px-2.5 py-1 text-[0.62rem]" title="Attach chart images or PDFs">
                  Attach
                  <input type="file" accept="image/*,application/pdf" multiple className="hidden" onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }} />
                </label>
                <button
                  className={`chip ${deep ? "!border-[color:var(--rule-strong)] text-text" : "opacity-60"}`}
                  onClick={() => setDeep((d) => !d)}
                  title="Deep mode thinks longer for richer, more careful answers"
                >
                  {deep ? "✦ Deep" : "Deep"}
                </button>
              </div>
              {sending ? (
                <button className="btn" onClick={() => abortRef.current?.abort()}>Stop</button>
              ) : (
                <button className="btn btn-gilt" onClick={() => send()} disabled={!input.trim() && attachments.length === 0}>Send</button>
              )}
            </div>
          </footer>
        </aside>
      )}
    </>
  );
}

/** Open the Oracle chat with a prefilled question (used by interpretation panels). */
export function askOracle(detail: OracleAskDetail) {
  window.dispatchEvent(new CustomEvent<OracleAskDetail>("oracle:ask", { detail }));
}
