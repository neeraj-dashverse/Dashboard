"use client";

import { useMemo, useState } from "react";
import { answerOps, type AskChoice, type AskReply } from "@/lib/ops/ask";
import { plannerRows, teamGroups } from "@/lib/ops/selectors";
import { SyncStrip } from "./SyncStrip";
import { useOps } from "./OpsProvider";

export function AskBoard() {
  const { snap } = useOps();
  const [question, setQuestion] = useState("");
  const [reply, setReply] = useState<AskReply | null>(null);
  const [asked, setAsked] = useState("");

  const ideas = useMemo(() => {
    const person = teamGroups(snap)
      .find((group) => group.id === "animation")
      ?.people.find((item) => item.holds.length > 0);
    const row = plannerRows(snap)[0];
    const prompts = [
      person
        ? `Where is ${person.name} plotted, and what rating and feedback do they have?`
        : "Who is still plotted in animation?",
      row
        ? `When will ${row.promo.showName} close, and how long will it take?`
        : "What is still open in production?",
      "Who is free, and who is past their plotted date?",
    ];
    return prompts;
  }, [snap]);

  async function ask(text: string, pick?: AskChoice) {
    const next = text.trim();
    if (!next) return;
    setQuestion(next);
    setAsked(next);
    const local = answerOps(snap, next, pick);
    setReply(local);
    if (local.choices?.length) return;
    try {
      const res = await fetch("/api/ops/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: next, facts: local.lines.join("\n") }),
      });
      const data = (await res.json()) as { summary?: string | null };
      if (data.summary) setReply({ ...local, lines: data.summary.split(/\n+/).filter(Boolean) });
    } catch {
      /* The sheet summary already on screen is the answer. */
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Ask AI</p>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-white">Ask the sheets</h1>
        <p className="mt-1 text-[12px] leading-5 text-slate-400">
          A misspelled show or artist asks you to pick the right row, then summarizes it. Parts that share a date are
          counted once. Add GEMINI_API_KEY to write that summary in Gemini. The facts still come from the sheets.
        </p>
      </div>
      <SyncStrip />

      <form
        className="space-y-3"
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
          placeholder="Where is Dhara plotted, and what feedback did she get?"
          className="w-full resize-none rounded-xl border border-white/[0.12] bg-[#222738] px-4 py-3 text-[14px] text-white outline-none placeholder:text-slate-500 focus:border-[#4361ee]"
        />
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="submit"
            className="rounded-full bg-[#4361ee] px-4 py-2 text-[12px] font-bold text-white hover:bg-[#5470f0]"
          >
            Ask
          </button>
          {ideas.map((idea) => (
            <button
              key={idea}
              type="button"
              onClick={() => ask(idea)}
              className="rounded-full border border-white/[0.12] px-3 py-1.5 text-left text-[11px] text-slate-300 hover:border-white/[0.24] hover:text-white"
            >
              {idea}
            </button>
          ))}
        </div>
      </form>

      {reply && (
        <section className="rounded-xl border border-white/[0.12] bg-[#222738] px-5 py-4">
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{asked}</p>
          <h2 className="mt-2 text-[18px] font-extrabold text-white">{reply.heading}</h2>
          <div className="mt-3 space-y-2">
            {reply.lines.map((line, index) => (
              <p key={`${index}-${line.slice(0, 24)}`} className="text-[13px] leading-5 text-slate-200">
                {line}
              </p>
            ))}
          </div>
          {reply.choices && reply.choices.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {reply.choices.map((choice) => (
                <button
                  key={`${choice.kind}-${choice.id}`}
                  type="button"
                  onClick={() => void ask(asked, choice)}
                  className="rounded-full border border-[#4361ee]/40 bg-[#4361ee]/15 px-3 py-1.5 text-left text-[12px] font-semibold text-[#d5deff] hover:bg-[#4361ee]/25"
                >
                  {choice.label}
                </button>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
