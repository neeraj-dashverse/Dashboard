import { incomingFiles } from "@/lib/ops/incoming-files";
import type { IncomingPromo } from "@/lib/ops/tasks";

export function IncomingPacket({
  row,
  compact = false,
}: {
  row: IncomingPromo;
  compact?: boolean;
}) {
  const files = incomingFiles(row);
  const script = files.find((file) => file.key === "script");

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {files.map((file) => {
          const className = file.added
            ? "rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[11px] font-semibold text-emerald-200"
            : "rounded-md border border-dashed border-white/[0.1] px-2 py-1 text-[11px] text-slate-500";
          const label = file.added ? `${file.label} ✓` : `${file.label} —`;
          if (file.href) {
            return (
              <a
                key={file.key}
                href={file.href}
                target="_blank"
                rel="noreferrer"
                className={`${className} hover:bg-emerald-500/20`}
                title={file.value ?? undefined}
              >
                {file.label} ↗
              </a>
            );
          }
          return (
            <span key={file.key} className={className} title={file.value ?? undefined}>
              {label}
            </span>
          );
        })}
      </div>
      {!compact && script?.added && (
        <p className="text-[13px] leading-5 text-amber-100/90">
          Script is on the PocketFM sheet
          {script.value && !script.href ? ` (“${script.value}”)` : ""}. Approve paste to put it on
          Master Tracker — I will also make a Google copy for the agency.
        </p>
      )}
      {!compact && script && !script.added && (
        <p className="text-[13px] leading-5 text-amber-200/90">
          PocketFM has not added a script on this row yet. Wait, or paste the link below.
        </p>
      )}
      {compact && script?.added && (
        <p className="text-[12px] text-amber-200/80">Script is there — paste it in Workflow and I will copy the Doc.</p>
      )}
    </div>
  );
}
