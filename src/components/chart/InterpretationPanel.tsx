"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Markdown } from "../ui/Markdown";
import { Sunburst, FrameCorners } from "../ui/Ornaments";
import { askOracle } from "../chat/OracleChat";

export interface InterpretRequest {
  personId: number | null;
  target: unknown;
  settings?: string;
}

/**
 * Slide-over panel: shows the engine's exact data for the clicked element,
 * then streams Claude's interpretation of that data.
 */
export function InterpretationPanel({
  request,
  title,
  facts,
  topic,
  endpoint = "/api/interpret",
  onDone,
  onClose,
  footerExtra,
  initialText,
}: {
  request: InterpretRequest | null;
  title: ReactNode;
  facts: ReactNode;
  /** plain-text subject, used to prefill a follow-up question in the chat */
  topic?: string;
  /** API route that streams the interpretation */
  endpoint?: string;
  /** called with the full text once streaming finishes */
  onDone?: (text: string) => void;
  onClose: () => void;
  footerExtra?: ReactNode;
  /** already-generated text to show instead of requesting a new one */
  initialText?: string | null;
}) {
  const [text, setText] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "streaming" | "done" | "error">("idle");
  const [cached, setCached] = useState(false);
  const [unconfigured, setUnconfigured] = useState(false);
  const [nonce, setNonce] = useState(0);
  const freshRef = useRef(false);
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);
  const key = request ? JSON.stringify(request) : "";

  useEffect(() => {
    if (!request) return;
    const ctrl = new AbortController();
    const fresh = freshRef.current;
    freshRef.current = false;
    if (initialText && !fresh) {
      setText(initialText);
      setCached(true);
      setStatus("done");
      return;
    }
    setText("");
    setCached(false);
    setUnconfigured(false);
    setStatus("loading");
    (async () => {
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...request, fresh }),
          signal: ctrl.signal,
        });
        if (!res.ok || !res.body) {
          const err = await res.json().catch(() => ({ error: res.statusText }));
          setText(`**Error:** ${err.error ?? res.statusText}`);
          setStatus("error");
          return;
        }
        setCached(res.headers.get("X-Cache") === "hit");
        setUnconfigured(res.headers.get("X-AI") === "unconfigured");
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        setStatus("streaming");
        let full = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = dec.decode(value, { stream: true });
          full += chunk;
          setText((t) => t + chunk);
        }
        setStatus("done");
        if (res.headers.get("X-AI") !== "unconfigured") onDoneRef.current?.(full);
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          setText((t) => `${t}\n\n**Error:** ${(e as Error).message}`);
          setStatus("error");
        }
      }
    })();
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, nonce]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!request) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-[rgb(9_18_24/0.45)] backdrop-blur-[1px]" onClick={onClose} />
      <aside className="frame-gilt fixed bottom-3 right-3 top-3 z-50 flex w-[min(620px,calc(100vw-1.5rem))] flex-col !bg-surface-strong">
        <FrameCorners />
        <header className="flex items-start justify-between gap-3 border-b border-rule px-5 pb-3 pt-4">
          <div>
            <p className="engraved text-[0.62rem] text-faint">Interpretation</p>
            <h2 className="engraved mt-0.5 text-lg text-accent-bright">{title}</h2>
          </div>
          <button onClick={onClose} className="btn px-2.5 py-1" aria-label="Close">✕</button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <details className="panel mb-4 px-3 py-2 text-sm" open>
            <summary className="engraved cursor-pointer text-[0.65rem] text-muted">Calculated data (Swiss Ephemeris)</summary>
            <div className="mt-2 space-y-1 text-[0.85rem] text-muted">{facts}</div>
          </details>
          {status === "loading" && (
            <div className="flex flex-col items-center gap-3 py-10 text-muted">
              <Sunburst size={56} className="animate-[spin_12s_linear_infinite] text-accent" />
              <p className="headline-italic text-sm font-normal">Consulting the ephemeris…</p>
            </div>
          )}
          {text && <Markdown text={text} />}
          {status === "streaming" && <span className="inline-block h-4 w-1.5 animate-pulse bg-accent align-middle" />}
        </div>
        <footer className="flex items-center justify-between gap-3 border-t border-rule px-5 py-2.5 text-xs text-faint">
          <span>{unconfigured ? "Calculations shown above need no API key" : cached ? "Saved interpretation" : status === "done" ? "Saved — reopening is instant" : "Grounded in engine data only"}</span>
          <span className="flex gap-2">
            {footerExtra}
            {topic && (
              <button
                className="btn px-3 py-1 text-[0.65rem]"
                onClick={() => {
                  askOracle({ text: `About ${topic}: `, personId: request.personId });
                  onClose();
                }}
              >
                Ask a follow-up
              </button>
            )}
            <button
              className="btn px-3 py-1 text-[0.65rem]"
              disabled={status === "loading" || status === "streaming"}
              onClick={() => {
                freshRef.current = true;
                setNonce((n) => n + 1);
              }}
            >
              Regenerate
            </button>
          </span>
        </footer>
      </aside>
    </>
  );
}
