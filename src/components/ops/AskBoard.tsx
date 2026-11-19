"use client";

import { useMemo, useRef, useState } from "react";
import { answerOps, type AskChoice, type AskIntent, type AskReply } from "@/lib/ops/ask";
import { buildTurnText, downloadThreadReport, downloadTurnReport } from "@/lib/ops/ask-report";
import { useOps } from "./OpsProvider";

type Turn = {
  id: number;
  question: string;
  reply: AskReply | null;
  waiting: boolean;
};

export function AskBoard() {
  const { snap } = useOps();
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [focus, setFocus] = useState<AskChoice | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const nextId = useMemo(() => ({ n: 1 }), []);
  const history = useRef<{ question: string; answer: string }[]>([]);
  const lastIntent = useRef<AskIntent | null>(null);

  const ideas = useMemo(
    () => [
      "When will animators be free?",
      "What is the quick status of current promos?",
      "When will we be delivering the promos?",
      "What is the productivity of each artist?",
      "When can I take new promos?",
      "What's the avg time to complete 1 promo?",
    ],
    []
  );

  async function ask(text: string, pick?: AskChoice, fresh = false) {
    const next = text.trim();
    if (!next) return;
    const remembered = fresh || pick ? undefined : focus ?? undefined;
    if (fresh) {
      setFocus(null);
      history.current = [];
      lastIntent.current = null;
    }
    const id = nextId.n++;
    setQuestion("");
    setTurns((current) => [...current, { id, question: next, reply: null, waiting: true }]);
    const local = answerOps(snap, next, pick, remembered, lastIntent.current);
    if (local.focus) setFocus(local.focus);
    if (local.intent) lastIntent.current = local.intent;
    if (local.choices?.length) {
      setTurns((current) => current.map((turn) => (turn.id === id ? { ...turn, reply: local, waiting: false } : turn)));
      return;
    }
    let lines = local.lines;
    if (!local.choices?.length) {
      // Serialize tables alongside the lines so the AI can answer questions whose answer lives in a table
      // (leave days, feedback remarks, per-part dates, productivity counts).
      const tables = local.tables?.length ? local.tables : local.table ? [local.table] : [];
      const tableText = tables
        .map((table) => {
          const header = [table.title, table.columns.join(" | ")].filter(Boolean).join("\n");
          return [header, ...table.rows.map((row) => row.join(" | "))].join("\n");
        })
        .join("\n\n");
      const facts = [local.lines.join("\n"), tableText].filter(Boolean).join("\n\n");
      try {
        const res = await fetch("/api/ops/ask", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question: next, facts, history: history.current.slice(-6), intent: local.intent }),
        });
        const data = (await res.json()) as { summary?: string | null };
        if (data.summary) lines = data.summary.split(/\n+/).filter(Boolean);
      } catch {
        /* Keep the sheet summary. */
      }
      history.current = [...history.current, { question: next, answer: lines.join(" ") }].slice(-6);
    }
    setTurns((current) =>
      current.map((turn) => (turn.id === id ? { ...turn, reply: { ...local, lines }, waiting: false } : turn))
    );
  }

  const finished = turns.filter((turn): turn is Turn & { reply: AskReply } => !!turn.reply && !turn.waiting);

  async function copyText(turn: Turn & { reply: AskReply }) {
    try {
      await navigator.clipboard.writeText(buildTurnText({ question: turn.question, reply: turn.reply }));
      setCopiedId(turn.id);
      setTimeout(() => setCopiedId((current) => (current === turn.id ? null : current)), 1800);
    } catch {
      /* Clipboard may be blocked; the download buttons still work. */
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Ask AI</p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-white">Ask the sheets</h1>
          <p className="mt-1 text-[12px] text-slate-500">Follow up below, or start New question for something else.</p>
        </div>
        {finished.length > 0 && (
          <button
            type="button"
            onClick={() => downloadThreadReport(finished.map((turn) => ({ question: turn.question, reply: turn.reply })))}
            className="shrink-0 rounded-full border border-[#4361ee]/40 bg-[#4361ee]/15 px-3 py-1.5 text-[11px] font-bold text-[#d5deff] hover:bg-[#4361ee]/25"
          >
            ⬇ Export whole thread (PDF)
          </button>
        )}
      </div>

      {turns.map((turn) => (
        <section key={turn.id} className="rounded-xl border border-white/[0.12] bg-[#222738] px-5 py-4">
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{turn.question}</p>
          {turn.waiting || !turn.reply ? (
            <p className="mt-3 text-[13px] text-slate-400">Reading the sheets…</p>
          ) : (
            <>
              <div className="mt-2 flex flex-wrap items-start justify-between gap-2">
                <h2 className="text-[18px] font-extrabold text-white">{turn.reply.heading}</h2>
                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    type="button"
                    title="Copy this answer as plain text"
                    onClick={() => void copyText(turn as Turn & { reply: AskReply })}
                    className="rounded-full border border-white/[0.14] px-2.5 py-1 text-[10px] font-semibold text-slate-300 hover:border-white/[0.28] hover:text-white"
                  >
                    {copiedId === turn.id ? "Copied" : "Copy text"}
                  </button>
                  <button
                    type="button"
                    title="Download this answer as a designed PDF report"
                    onClick={() => downloadTurnReport({ question: turn.question, reply: turn.reply as AskReply })}
                    className="rounded-full border border-white/[0.14] px-2.5 py-1 text-[10px] font-semibold text-slate-300 hover:border-white/[0.28] hover:text-white"
                  >
                    PDF report
                  </button>
                </div>
              </div>
              <div className="mt-3 space-y-2">
                {turn.reply.lines.map((line, index) => (
                  <p key={`${turn.id}-${index}`} className="text-[13px] leading-5 text-slate-200">
                    {line}
                  </p>
                ))}
              </div>
              {((turn.reply.tables && turn.reply.tables.length > 0
                ? turn.reply.tables
                : turn.reply.table
                  ? [turn.reply.table]
                  : []) as { title?: string; columns: string[]; rows: string[][] }[]).map((table) => (
                <div key={table.title ?? table.columns.join()} className="mt-3 overflow-x-auto rounded-lg border border-white/[0.08]">
                  {table.title && (
                    <p className="px-2 pt-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">{table.title}</p>
                  )}
                  <table className="w-full text-left text-[12px]">
                    <thead className="text-[10px] uppercase tracking-wide text-slate-400">
                      <tr>
                        {table.columns.map((column) => (
                          <th key={column} className="px-2 py-2 font-semibold">
                            {column}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {table.rows.map((row, index) => (
                        <tr key={`${turn.id}-${table.title ?? "t"}-${index}`} className="border-t border-white/[0.06]">
                          {row.map((cell, cellIndex) => (
                            <td key={cellIndex} className="px-2 py-1.5 text-slate-200">
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
              {turn.reply.choices && turn.reply.choices.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {turn.reply.choices.map((choice) => (
                    <button
                      key={`${choice.kind}-${choice.id}`}
                      type="button"
                      onClick={() => void ask(turn.question, choice)}
                      className="rounded-full border border-[#4361ee]/40 bg-[#4361ee]/15 px-3 py-1.5 text-left text-[12px] font-semibold text-[#d5deff] hover:bg-[#4361ee]/25"
                    >
                      {choice.label}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </section>
      ))}

      <form
        className="space-y-3 rounded-xl border border-white/[0.14] bg-[#1b1f2e] p-4"
        onSubmit={(event) => {
          event.preventDefault();
          ask(question);
        }}
      >
        <textarea
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              ask(question);
            }
          }}
          rows={3}
          placeholder={turns.length ? "Ask a follow-up…" : "Where is Dhara plotted, and what feedback did she get?"}
          className="w-full resize-none rounded-xl border border-white/[0.12] bg-[#222738] px-4 py-3 text-[14px] text-white outline-none placeholder:text-slate-500 focus:border-[#4361ee]"
        />
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="submit"
            className="rounded-full bg-[#4361ee] px-4 py-2 text-[12px] font-bold text-white hover:bg-[#5470f0]"
          >
            Ask
          </button>
          {turns.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setFocus(null);
                history.current = [];
                lastIntent.current = null;
                setQuestion("");
              }}
              className="rounded-full border border-white/[0.12] px-3 py-1.5 text-[12px] font-semibold text-slate-300 hover:text-white"
            >
              New question
            </button>
          )}
          {ideas.map((idea) => (
            <button
              key={idea}
              type="button"
              onClick={() => ask(idea, undefined, true)}
              className="rounded-full border border-white/[0.12] px-3 py-1.5 text-left text-[11px] text-slate-300 hover:border-white/[0.24] hover:text-white"
            >
              {idea}
            </button>
          ))}
        </div>
      </form>
    </div>
  );
}
