"use client";

import { useMemo, useState } from "react";
import { answerOps, type AskReply } from "@/lib/ops/ask";
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

  function ask(text: string) {
    const next = text.trim();
    if (!next) return;
    setQuestion(next);
    setAsked(next);
    setReply(answerOps(snap, next));
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Ask AI</p>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-white">Ask the sheets</h1>
        <p className="mt-1 text-[12px] leading-5 text-slate-400">
          Ask where an artist is plotted, their rating, feedback, and productivity, or when a promo is plotted to close.
          Answers use the production, team, quality, and daily productivity sheets.
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
        </section>
      )}
    </div>
  );
}
