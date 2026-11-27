import { cellHref } from "@/lib/ops/incoming-files";
import { googleCopyUrl, googleFileId } from "@/lib/ops/google-file";

export function ScriptPasteBar({
  script,
  kind,
  busy,
  onPaste,
}: {
  script: string | null | undefined;
  kind: "paste" | "updated" | "copy";
  busy: boolean;
  onPaste: (script: string, makeCopy: boolean) => void;
}) {
  const href = cellHref(script) ?? (googleFileId(script ?? "") ? script?.trim() ?? null : null);
  const copyHref = googleCopyUrl(script);
  if (!script?.trim()) return null;

  return (
    <div
      className={`space-y-2 rounded-xl border px-3 py-3 ${
        kind === "updated"
          ? "border-rose-500/30 bg-rose-500/10"
          : "border-[#4361ee]/30 bg-[#4361ee]/10"
      }`}
    >
      <p className="text-[12px] font-semibold text-white">
        {kind === "updated"
          ? "Someone changed the script on the PocketFM sheet."
          : kind === "copy"
            ? "Script is on Master Tracker. Make the Google copy for the agency (column J)."
            : "PocketFM added a script. Approve to paste it onto Master Tracker."}
      </p>
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="block truncate text-[12px] font-semibold text-[#9bb0ff] hover:underline"
        >
          Open script ↗
        </a>
      ) : (
        <p className="truncate text-[12px] text-slate-300">{script}</p>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => onPaste(href || script, true)}
          className="rounded-lg bg-[#4361ee] px-3 py-2 text-[12px] font-bold text-white hover:bg-[#5470f0] disabled:opacity-40"
        >
          {kind === "updated"
            ? "Paste update and make a copy"
            : kind === "copy"
              ? "Make Google copy"
              : "Paste to Master Tracker and make a copy"}
        </button>
        {kind !== "copy" && (
          <button
            type="button"
            disabled={busy}
            onClick={() => onPaste(href || script, false)}
            className="rounded-lg bg-white/[0.08] px-3 py-2 text-[12px] font-bold text-white hover:bg-white/[0.12] disabled:opacity-40"
          >
            Paste link only
          </button>
        )}
        {copyHref && (
          <a
            href={copyHref}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg px-3 py-2 text-[12px] font-bold text-slate-300 hover:text-white"
          >
            Manual Google copy ↗
          </a>
        )}
      </div>
    </div>
  );
}
