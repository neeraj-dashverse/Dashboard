"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { cpsLoad } from "@/lib/ops/cps-load";
import type { IncomingPromo } from "@/lib/ops/tasks";
import { useOps } from "./OpsProvider";

type Draft = {
  promoName: string;
  madeScripts: boolean;
  script: string;
  agencyScript: string;
  demarcatedScript: string;
  cps: string;
};

const emptyDraft = (row: IncomingPromo): Draft => ({
  promoName: row.promoName,
  madeScripts: false,
  script: row.scriptLink ?? "",
  agencyScript: "",
  demarcatedScript: "",
  cps: "",
});

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

function WorkflowCard({
  row,
  draft,
  setDraft,
  cps,
  busy,
  error,
  onName,
  onIntake,
}: {
  row: IncomingPromo;
  draft: Draft;
  setDraft: (next: Draft) => void;
  cps: ReturnType<typeof cpsLoad>;
  busy: boolean;
  error: string;
  onName: () => void;
  onIntake: () => void;
}) {
  const named = Boolean(draft.promoName.trim());
  const scriptsReady =
    draft.madeScripts && draft.agencyScript.trim().length > 0 && draft.demarcatedScript.trim().length > 0;
  const step = !named ? 1 : !scriptsReady ? 2 : 3;

  return (
    <article className="overflow-hidden rounded-2xl border border-white/[0.1] bg-[#161a26]">
      <div className="border-b border-white/[0.06] bg-[#1b2133] px-5 py-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">New on PocketFM</p>
        <h2 className="mt-1 text-lg font-extrabold text-white">{row.showName || "Untitled show"}</h2>
        <p className="text-[13px] text-slate-400">
          {named ? draft.promoName : "Promo name is missing — add it on your Master Tracker"}
        </p>
      </div>

      <div className="space-y-5 p-5">
        <div className="flex flex-wrap gap-4 text-[11px] text-slate-400">
          <span className="flex items-center gap-2">
            <StepDot n={1} done={named} current={step === 1} /> Name
          </span>
          <span className="flex items-center gap-2">
            <StepDot n={2} done={scriptsReady} current={step === 2} /> Agency + demarcated
          </span>
          <span className="flex items-center gap-2">
            <StepDot n={3} done={false} current={step === 3} /> Assign CP
          </span>
        </div>

        <section>
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">1 · Promo name</p>
          {row.needsName || !named ? (
            <div className="mt-2 flex flex-wrap gap-2">
              <input
                value={draft.promoName}
                onChange={(event) => setDraft({ ...draft, promoName: event.target.value })}
                placeholder="Type the promo name for Master Tracker"
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
          ) : (
            <p className="mt-1 text-[13px] text-emerald-200">{draft.promoName}</p>
          )}
        </section>

        <section className={named ? "" : "pointer-events-none opacity-40"}>
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            2 · Make the agency copy and demarcated script
          </p>
          <p className="mt-1 text-[13px] leading-5 text-slate-400">
            Before a CP is assigned, strip PocketFM from the agency copy and split the demarcated script.
            Then paste the three links. They are saved on your Master Tracker (I–K), not the PocketFM sheet.
          </p>
          <label className="mt-3 flex items-start gap-2 text-[13px] text-slate-200">
            <input
              type="checkbox"
              checked={draft.madeScripts}
              onChange={(event) => setDraft({ ...draft, madeScripts: event.target.checked })}
              className="mt-1 accent-[#4361ee]"
            />
            Agency copy and demarcated script are ready to paste
          </label>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {(
              [
                ["script", "Script (original)", "Paste original / working script"],
                ["agencyScript", "Agency script", "Paste agency copy"],
                ["demarcatedScript", "Demarcated script", "Paste demarcated script"],
              ] as const
            ).map(([key, label, placeholder]) => (
              <label key={key} className="block text-[10px] font-bold uppercase tracking-wide text-slate-500">
                {label}
                <input
                  value={draft[key]}
                  onChange={(event) => setDraft({ ...draft, [key]: event.target.value })}
                  placeholder={placeholder}
                  disabled={!draft.madeScripts}
                  className="mt-1 w-full rounded-lg border border-white/[0.12] bg-[#222738] px-3 py-2 text-[13px] font-normal normal-case tracking-normal text-white placeholder:text-slate-600 disabled:opacity-40"
                />
              </label>
            ))}
          </div>
        </section>

        <section className={scriptsReady ? "" : "pointer-events-none opacity-40"}>
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            3 · Assign CP, then record to Master Tracker
          </p>
          <p className="mt-1 text-[13px] text-slate-400">
            Current open load is shown so you can pick who has room.
          </p>
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
                      {person.openPromos.length > 4 && (
                        <li>+{person.openPromos.length - 4} more</li>
                      )}
                    </ul>
                  )}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            disabled={busy || !scriptsReady || !draft.cps || !named}
            onClick={onIntake}
            className="mt-4 w-full rounded-xl bg-[#4361ee] px-4 py-2.5 text-[13px] font-bold text-white hover:bg-[#5470f0] disabled:opacity-40"
          >
            Record to Master Tracker
          </button>
        </section>

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
  const cps = useMemo(() => cpsLoad(snap), [snap]);

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
        const rows = data.incoming ?? [];
        setIncoming(rows);
        setDrafts((current) => {
          const next = { ...current };
          for (const row of rows) if (!next[row.id]) next[row.id] = emptyDraft(row);
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
    setDrafts((current) => ({ ...current, [active.id]: next }));
    setError("");
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
      setError("Could not write to the sheet.");
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
          New PocketFM row → name it if blank → make agency + demarcated scripts → paste links → pick a
          CP → everything is written to your Master Tracker.
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
              setDraft={patch}
              cps={cps}
              busy={busy}
              error={error}
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
