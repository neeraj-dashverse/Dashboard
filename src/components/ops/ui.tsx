import type { Stage } from "@/lib/ops/types";
import { STAGE_LABEL } from "@/lib/ops/selectors";

export function StagePill({ stage }: { stage: Stage }) {
  const styles: Record<Stage, string> = {
    planning: "bg-emerald-500/15 text-emerald-300",
    animation: "bg-rose-500/15 text-rose-300",
    edit: "bg-blue-500/15 text-blue-300",
    correction: "bg-amber-500/15 text-amber-300",
    sound: "bg-purple-500/15 text-purple-300",
    delivered: "bg-white/[0.06] text-slate-400",
  };
  return (
    <span
      className={`inline-block rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${styles[stage]}`}
    >
      {STAGE_LABEL[stage]}
    </span>
  );
}

export function KindPill({ kind }: { kind: string }) {
  const map: Record<string, string> = {
    overdue: "bg-rose-500/20 text-rose-300",
    blocked: "bg-amber-500/20 text-amber-300",
    "due-today": "bg-[#4361ee]/20 text-[#9bb0ff]",
    "delivery-risk": "bg-[#d6293d]/25 text-[#ff8a98]",
    "five-min-due": "bg-purple-500/20 text-purple-300",
  };
  const label =
    kind === "five-min-due"
      ? "5-min due"
      : kind === "delivery-risk"
        ? "delivery"
        : kind.replace(/-/g, " ");
  return (
    <span
      className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${map[kind] ?? "bg-white/10 text-slate-400"}`}
    >
      {label}
    </span>
  );
}

export function PriorityPill({ priority }: { priority: string | null }) {
  if (!priority) return null;
  const hot = priority === "P0";
  return (
    <span
      className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${
        hot ? "bg-[#d6293d]/25 text-[#ff8a98]" : "bg-white/[0.06] text-slate-400"
      }`}
    >
      {priority}
    </span>
  );
}

export function Kpi({
  label,
  value,
  tone = "text-white",
}: {
  label: string;
  value: string | number;
  tone?: string;
}) {
  return (
    <div className="rounded-lg border border-white/[0.08] bg-[#121216] px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`mt-0.5 text-xl font-bold tabular-nums ${tone}`}>{value}</p>
    </div>
  );
}

export function SectionTitle({
  title,
  hint,
  count,
}: {
  title: string;
  hint?: string;
  count?: number;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h2 className="flex items-baseline gap-2 text-[13px] font-semibold text-white">
        {title}
        {count != null && (
          <span className="rounded-full bg-white/[0.08] px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-slate-400">
            {count}
          </span>
        )}
      </h2>
      {hint && <span className="text-[11px] text-slate-500">{hint}</span>}
    </div>
  );
}

/** Small category tag used in the unified action feed. */
export function Tag({ label, tone }: { label: string; tone?: string }) {
  return (
    <span
      className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
        tone ?? "bg-white/[0.08] text-slate-400"
      }`}
    >
      {label}
    </span>
  );
}
