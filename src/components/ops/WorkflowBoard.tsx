"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { findCreditForNames } from "@/lib/ops/credits";
import { cpsLoad } from "@/lib/ops/cps-load";
import type { IncomingPromo } from "@/lib/ops/tasks";
import type { CreditUsage } from "@/lib/ops/types";
import { DEMARCATE_PROMPT } from "@/lib/ops/workflow-prompt";
import { filterWorkflowIncoming } from "@/lib/ops/workflow-queue";
import { CreditStats } from "./CreditStats";
import { useOps } from "./OpsProvider";

type Draft = {
  promoName: string;
  script: string;
  gotScript: boolean;
  agencyScript: string;
  demarcatedScript: string;
  cps: string;
};

const DRAFTS_KEY = "ops-workflow-drafts";

const emptyDraft = (row: IncomingPromo): Draft => ({
  promoName: row.promoName,
  script: row.scriptLink ?? "",
  gotScript: false,
  agencyScript: "",
  demarcatedScript: "",
  cps: "",
});

function loadDrafts(): Record<string, Draft> {
  try {
    const raw = window.localStorage.getItem(DRAFTS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, Draft>) : {};
  } catch {
    return {};
  }
}

function saveDrafts(drafts: Record<string, Draft>): void {
  window.localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts));
}

function StepDot({ n, done, current }: { n: number; done: boolean; current: boolean }) {
  return (
    <span
      className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ${
        done
          ? "bg-emerald-500/20 text-emerald-200"
          : current
            ? "bg-[#4361ee] text-white"
            : "bg-white/[0.06] text-slate-500"
      }`}
    >
      {done ? "✓" : n}
    </span>
  );
}

function Step({
  n,
  title,
  done,
  current,
  locked,
  children,
}: {
  n: number;
  title: string;
  done: boolean;
  current: boolean;
  locked: boolean;
  children: ReactNode;
}) {
  return (
    <section className={locked ? "pointer-events-none opacity-35" : ""}>
      <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">
        <StepDot n={n} done={done} current={current} />
        {title}
      </p>
      {(current || done) && <div className="mt-2 pl-8">{children}</div>}
    </section>
  );
}

function LinkOrDash({ href, label }: { href: string; label: string }) {
  if (!href.trim()) return <span className="text-[13px] text-slate-500">{label} —</span>;
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="text-[13px] font-semibold text-[#9bb0ff] hover:underline"
    >
      {label} ↗
    </a>
  );
}

function WorkflowCard({
  row,
  draft,
  setDraft,
  cps,
  creditUsage,
  busy,
  error,
  copied,
  onCopyPrompt,
  onName,
  onIntake,
}: {
  row: IncomingPromo;
  draft: Draft;
  setDraft: (next: Draft) => void;
  cps: ReturnType<typeof cpsLoad>;
  creditUsage: CreditUsage | null;
  busy: boolean;
  error: string;
  copied: boolean;
  onCopyPrompt: () => void;
  onName: () => void;
  onIntake: () => void;
}) {
  const hasScript = Boolean(draft.gotScript && draft.script.trim());
  const hasAgency = Boolean(draft.agencyScript.trim());
  const hasDem = Boolean(draft.demarcatedScript.trim());
  const named = Boolean(draft.promoName.trim());
  const step = !hasScript ? 1 : !hasAgency ? 2 : !hasDem ? 3 : !named ? 4 : 5;
  const pocketScript = row.scriptLink?.trim() || "";

  return (
    <article className="overflow-hidden rounded-2xl border border-white/[0.1] bg-[#161a26]">
      <div className="border-b border-white/[0.06] bg-[#1b2133] px-5 py-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">New on PocketFM</p>
        <h2 className="mt-1 text-lg font-extrabold text-white">{row.showName || "Untitled show"}</h2>
        <p className="text-[13px] text-slate-400">{named ? draft.promoName : "Promo name still needed before record"}</p>
        {creditUsage && (
          <div className="mt-3">
            <CreditStats usage={creditUsage} compact />
          </div>
        )}
      </div>

      <div className="space-y-6 p-5">
        <div className="flex flex-wrap gap-3 text-[11px] text-slate-400">
          {[
            [1, "Script"],
            [2, "Agency copy"],
            [3, "Demarcate"],
            [4, "Name"],
            [5, "CP"],
          ].map(([n, label]) => (
            <span key={n} className="flex items-center gap-1.5">
              <StepDot n={Number(n)} done={step > Number(n)} current={step === Number(n)} />
              {label}
            </span>
          ))}
        </div>

        <Step n={1} title="Get the original script from PocketFM" done={hasScript} current={step === 1} locked={false}>
          {pocketScript ? (
            <p className="text-[13px] leading-5 text-slate-400">
              This link is column P on the PocketFM Master Sheet. Open it first — that is the source script.
            </p>
          ) : (
            <p className="text-[13px] leading-5 text-amber-200/90">
              PocketFM has no script link on this row yet. Paste it if you have it, otherwise wait for PocketFM.
            </p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {pocketScript && (
              <a
                href={pocketScript}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg bg-[#4361ee] px-3 py-2 text-[12px] font-bold text-white hover:bg-[#5470f0]"
              >
                Open PocketFM script
              </a>
            )}
            {hasScript ? (
              <LinkOrDash href={draft.script} label="Original script" />
            ) : (
              <>
                {!pocketScript && (
                  <input
                    value={draft.script}
                    onChange={(event) => setDraft({ ...draft, script: event.target.value })}
                    placeholder="Paste the PocketFM script link if it is missing"
                    className="min-w-[220px] flex-1 rounded-lg border border-white/[0.12] bg-[#222738] px-3 py-2 text-[13px] text-white placeholder:text-slate-500"
                  />
                )}
                <button
                  type="button"
                  disabled={!draft.script.trim()}
                  onClick={() => setDraft({ ...draft, gotScript: true, script: draft.script.trim() || pocketScript })}
                  className="rounded-lg bg-white/[0.08] px-3 py-2 text-[12px] font-bold text-white hover:bg-white/[0.12] disabled:opacity-40"
                >
                  I have this script — next
                </button>
              </>
            )}
          </div>
        </Step>

        <Step
          n={2}
          title="Make a Google copy — that is the agency script"
          done={hasAgency}
          current={step === 2}
          locked={step < 2}
        >
          <p className="text-[13px] leading-5 text-slate-400">
            In the original script: File → Make a copy (Google Sheet or Doc). Strip every PocketFM mention. Paste
            that copy’s link here. This becomes Master Tracker · Agency script (J).
          </p>
          {hasAgency ? (
            <p className="mt-2">
              <LinkOrDash href={draft.agencyScript} label="Agency script" />
            </p>
          ) : (
            <input
              value={draft.agencyScript}
              onChange={(event) => setDraft({ ...draft, agencyScript: event.target.value })}
              placeholder="Paste the Google copy link"
              className="mt-2 w-full rounded-lg border border-white/[0.12] bg-[#222738] px-3 py-2 text-[13px] text-white placeholder:text-slate-500"
            />
          )}
        </Step>

        <Step
          n={3}
          title="Demarcate that agency copy with the prompt"
          done={hasDem}
          current={step === 3}
          locked={step < 3}
        >
          <p className="text-[13px] leading-5 text-slate-400">
            Use the agency copy only. Copy the prompt, run it on that copy, then paste the demarcated file link.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onCopyPrompt}
              className="rounded-lg bg-white/[0.08] px-3 py-2 text-[12px] font-bold text-white hover:bg-white/[0.12]"
            >
              {copied ? "Prompt copied" : "Copy demarcation prompt"}
            </button>
            {draft.agencyScript && (
              <a
                href={draft.agencyScript}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg px-3 py-2 text-[12px] font-bold text-[#9bb0ff] hover:underline"
              >
                Agency copy ↗
              </a>
            )}
          </div>
          <pre className="mt-3 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg border border-white/[0.08] bg-black/30 p-3 text-[11px] leading-4 text-slate-400">
            {DEMARCATE_PROMPT}
          </pre>
          {hasDem ? (
            <p className="mt-2">
              <LinkOrDash href={draft.demarcatedScript} label="Demarcated script" />
            </p>
          ) : (
            <input
              value={draft.demarcatedScript}
              onChange={(event) => setDraft({ ...draft, demarcatedScript: event.target.value })}
              placeholder="Paste the demarcated script link"
              className="mt-2 w-full rounded-lg border border-white/[0.12] bg-[#222738] px-3 py-2 text-[13px] text-white placeholder:text-slate-500"
            />
          )}
        </Step>

        <Step n={4} title="Promo name on Master Tracker" done={named} current={step === 4} locked={step < 4}>
          {named && !row.needsName ? (
            <p className="text-[13px] text-emerald-200">{draft.promoName}</p>
          ) : (
            <>
              <p className="text-[13px] leading-5 text-slate-400">
                PocketFM left the promo name blank. Add it here — it writes to your Master Tracker, not PocketFM.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <input
                  value={draft.promoName}
                  onChange={(event) => setDraft({ ...draft, promoName: event.target.value })}
                  placeholder="Promo name"
                  className="min-w-[220px] flex-1 rounded-lg border border-white/[0.12] bg-[#222738] px-3 py-2 text-[13px] text-white placeholder:text-slate-500"
                />
                <button
                  type="button"
                  disabled={busy || !draft.promoName.trim() || !row.showName.trim()}
                  onClick={onName}
                  className="rounded-lg bg-white/[0.08] px-3 py-2 text-[12px] font-bold text-white hover:bg-white/[0.12] disabled:opacity-40"
                >
                  Save name to Master Tracker
                </button>
              </div>
            </>
          )}
        </Step>

        <Step n={5} title="Assign CP, then record" done={false} current={step === 5} locked={step < 5}>
          <p className="text-[13px] text-slate-400">Original, agency, and demarcated links go to Master Tracker I–K.</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {cps.map((person) => {
              const selected = draft.cps === person.name;
              const lightest = cps[0]?.name === person.name;
              return (
                <button
                  key={person.name}
                  type="button"
                  onClick={() => setDraft({ ...draft, cps: person.name })}
                  className={`rounded-xl border p-3 text-left ${
                    selected
                      ? "border-[#4361ee] bg-[#4361ee]/15"
                      : "border-white/[0.1] bg-[#222738] hover:border-white/[0.2]"
                  }`}
                >
                  <p className="flex items-center justify-between gap-2">
                    <span className="font-bold text-white">{person.name}</span>
                    <span className="text-[11px] tabular-nums text-slate-400">
                      {person.openPromos.length} open
                      {lightest ? " · lightest" : ""}
                    </span>
                  </p>
                  {person.openPromos.length === 0 ? (
                    <p className="mt-1 text-[12px] text-emerald-300">No open promo right now</p>
                  ) : (
                    <ul className="mt-1 space-y-0.5 text-[12px] text-slate-400">
                      {person.openPromos.slice(0, 4).map((promo) => (
                        <li key={promo.id} className="truncate">
                          {promo.title}
                        </li>
                      ))}
                      {person.openPromos.length > 4 && <li>+{person.openPromos.length - 4} more</li>}
                    </ul>
                  )}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            disabled={busy || step < 5 || !draft.cps}
            onClick={onIntake}
            className="mt-4 w-full rounded-xl bg-[#4361ee] px-4 py-2.5 text-[13px] font-bold text-white hover:bg-[#5470f0] disabled:opacity-40"
          >
            Record to Master Tracker
          </button>
        </Step>

        {error && <p className="text-[12px] text-rose-300">{error}</p>}
      </div>
    </article>
  );
}

export function WorkflowBoard() {
  const { snap, reset } = useOps();
  const [incoming, setIncoming] = useState<IncomingPromo[] | null>(null);
  const [picked, setPicked] = useState<string>("");
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const cps = useMemo(() => cpsLoad(snap), [snap]);

  useEffect(() => {
    setDrafts(loadDrafts());
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/ops/incoming", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ knownIds: snap.promos.map((promo) => promo.id) }),
    })
      .then((res) => res.json())
      .then((data: { incoming?: IncomingPromo[] }) => {
        if (cancelled) return;
        const rows = filterWorkflowIncoming(data.incoming ?? [], snap);
        setIncoming(rows);
        setDrafts((current) => {
          const next = { ...current };
          for (const row of rows) {
            if (!next[row.id]) next[row.id] = emptyDraft(row);
            else if (!next[row.id].script && row.scriptLink) next[row.id] = { ...next[row.id], script: row.scriptLink };
            if (!next[row.id].promoName && row.promoName) next[row.id] = { ...next[row.id], promoName: row.promoName };
          }
          saveDrafts(next);
          return next;
        });
        setPicked((current) => (rows.some((row) => row.id === current) ? current : rows[0]?.id || ""));
      })
      .catch(() => {
        if (!cancelled) setIncoming([]);
      });
    return () => {
      cancelled = true;
    };
  }, [snap.promos]);

  const active = incoming?.find((row) => row.id === picked) ?? incoming?.[0] ?? null;
  const draft = active ? drafts[active.id] ?? emptyDraft(active) : null;

  function patch(next: Draft) {
    if (!active) return;
    const updated = { ...drafts, [active.id]: next };
    setDrafts(updated);
    saveDrafts(updated);
    setError("");
  }

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(DEMARCATE_PROMPT);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Could not copy the prompt — select it from the box below.");
    }
  }

  async function post(body: Record<string, unknown>) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/ops/workflow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error || "Could not write to Master Tracker.");
        return;
      }
      await reset();
    } catch {
      setError("Could not write to Master Tracker.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Intake</p>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-white">Workflow</h1>
        <p className="mt-1 max-w-2xl text-[13px] leading-5 text-slate-400">
          One step at a time: PocketFM script → Google copy as agency script → demarcate with the prompt →
          name if blank → assign CP. Links save to your Master Tracker.
        </p>
      </div>

      {incoming == null ? (
        <p className="rounded-xl border border-dashed border-white/[0.1] px-4 py-8 text-center text-[13px] text-slate-500">
          Checking the PocketFM Master Sheet…
        </p>
      ) : incoming.length === 0 ? (
        <p className="rounded-xl border border-dashed border-white/[0.1] px-4 py-8 text-center text-[13px] text-slate-500">
          No new PocketFM promo is waiting. When a row is added there, it will show up here first.
        </p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
          <aside className="space-y-1">
            <p className="px-1 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Waiting · {incoming.length}
            </p>
            {incoming.map((row) => {
              const selected = (active?.id ?? "") === row.id;
              return (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => {
                    setPicked(row.id);
                    setError("");
                  }}
                  className={`w-full rounded-xl px-3 py-2.5 text-left ${
                    selected ? "bg-[#4361ee]/20 text-white" : "text-slate-300 hover:bg-white/[0.04]"
                  }`}
                >
                  <p className="truncate text-[13px] font-semibold">{row.showName || "—"}</p>
                  <p className="truncate text-[11px] text-slate-500">
                    {row.needsName ? "Needs a promo name" : row.promoName}
                  </p>
                </button>
              );
            })}
          </aside>

          {active && draft && (
            <WorkflowCard
              row={active}
              draft={draft}
              creditUsage={findCreditForNames(snap.creditUsages ?? [], active.showName, draft.promoName || active.promoName)}
              setDraft={patch}
              cps={cps}
              busy={busy}
              error={error}
              copied={copied}
              onCopyPrompt={copyPrompt}
              onName={() =>
                post({
                  action: "name",
                  showName: active.showName,
                  promoName: draft.promoName,
                })
              }
              onIntake={() =>
                post({
                  action: "intake",
                  showName: active.showName,
                  promoName: draft.promoName,
                  cps: draft.cps,
                  script: draft.script,
                  agencyScript: draft.agencyScript,
                  demarcatedScript: draft.demarcatedScript,
                })
              }
            />
          )}
        </div>
      )}

      <p className="text-[12px] text-slate-600">
        Home stays a glance. This tab is the place to take a new promo onto your tracker.{" "}
        <Link href="/home" className="text-slate-400 hover:text-white">
          Back to Home
        </Link>
      </p>
    </div>
  );
}
