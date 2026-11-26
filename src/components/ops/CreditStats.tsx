import Link from "next/link";
import {
  creditStatusTone,
  formatCredits,
  formatMin,
  formatPerMin,
  formatUsd,
  type CreditCompare,
} from "@/lib/ops/credits";
import type { CreditUsage } from "@/lib/ops/types";

export function CreditStats({
  usage,
  compare,
  compact = false,
}: {
  usage: CreditUsage | null | undefined;
  compare?: CreditCompare | null;
  compact?: boolean;
}) {
  if (!usage) {
    return <p className="text-[12px] text-slate-600">No PFM Promo credit row</p>;
  }
  if (compact) {
    return (
      <div>
        <p className="text-[15px] font-extrabold tabular-nums text-cyan-100">
          {formatCredits(usage.totalCredits)}
        </p>
        <p className="text-[11px] tabular-nums text-slate-400">
          V {formatCredits(usage.videos)} · LLM {formatCredits(usage.llm)} · Img {formatCredits(usage.images)}
        </p>
        <p className={`text-[11px] ${creditStatusTone(usage.status)}`}>
          In-house {formatPerMin(compare?.inHousePerMin)}
          {compare?.agencyMin ? ` · Agency ${formatMin(compare.agencyMin)} @ ${formatUsd(compare.agencyPayPerMin)}/min` : ""}
        </p>
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-cyan-500/20 bg-[#121922] p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-500/80">
            Promo credits
          </p>
          <p className="mt-1 text-[13px] text-slate-300">{usage.label}</p>
        </div>
        <Link href="/credits" className="text-[11px] font-bold text-cyan-300 hover:underline">
          Open Credits →
        </Link>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <Stat label="Videos" value={formatCredits(usage.videos)} />
        <Stat label="LLM" value={formatCredits(usage.llm)} />
        <Stat label="Images" value={formatCredits(usage.images)} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Stat label="Total credits" value={formatCredits(usage.totalCredits)} />
        <Stat label="In-house min" value={formatMin(compare?.inHouseMin)} />
        <Stat label="In-house / min" value={formatPerMin(compare?.inHousePerMin)} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Stat label="Agency min" value={formatMin(compare?.agencyMin)} />
        <Stat label="Agency pay / min" value={formatUsd(compare?.agencyPayPerMin)} />
        <Stat label="Agency pay" value={formatUsd(compare?.agencyPay)} />
      </div>
      {compare?.trackerInHousePerMin != null && (
        <p className="mt-2 text-[11px] text-slate-500">
          Tracker in-house / min: {formatPerMin(compare.trackerInHousePerMin)}
        </p>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="rounded-lg border border-cyan-500/10 bg-black/20 px-2.5 py-2">
      <p className="text-[9px] font-bold uppercase tracking-wider text-cyan-700">{label}</p>
      <p className={`text-[15px] font-extrabold tabular-nums ${tone ?? "text-white"}`}>{value}</p>
    </div>
  );
}
