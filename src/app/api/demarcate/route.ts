import { NextRequest, NextResponse } from "next/server";
import {
  buildAnomalyMarkdown,
  buildDemarcationDocx,
  runDemarcation,
} from "@/lib/demarcation";

export const runtime = "nodejs";

/** Analyze script text → demarcation JSON (scene map, trade-offs, QC). */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const sourceText = String(body.sourceText ?? "");
    if (!sourceText.trim()) {
      return NextResponse.json({ error: "Paste or upload a script first." }, { status: 400 });
    }
    const result = runDemarcation({
      sourceText,
      scriptName: body.scriptName,
      epLabel: body.epLabel,
      selectedPartCount: body.selectedPartCount ?? null,
    });

    if (body.format === "docx") {
      if (result.fidelityFailures > 0 && !body.forceExport) {
        return NextResponse.json(
          {
            error: "Parse fidelity failures > 0 — fix or pass forceExport with visible warning.",
            fidelityFailures: result.fidelityFailures,
          },
          { status: 400 }
        );
      }
      const buf = await buildDemarcationDocx(result);
      const filename = `${result.scriptName.replace(/\s+/g, "_")}_demarcation.docx`;
      return new NextResponse(new Uint8Array(buf), {
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }

    if (body.format === "md") {
      const md = buildAnomalyMarkdown(result);
      return new NextResponse(md, {
        headers: {
          "Content-Type": "text/markdown; charset=utf-8",
          "Content-Disposition": `attachment; filename="anomaly_log.md"`,
        },
      });
    }

    return NextResponse.json(result);
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Demarcation failed" },
      { status: 500 }
    );
  }
}
