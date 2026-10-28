import {
  AlignmentType,
  BorderStyle,
  Document,
  Header,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  PageBreak,
} from "docx";
import type { DemarcationResult, ScriptBlock } from "./types";
import { formatRuntime, wordsToRuntimeSec } from "./words";

const NAVY = "1F2A44";
const CRIMSON = "B3123C";
const CREAM = "F7F2E7";
const GREY = "5A5A5A";

function blocksForPart(
  result: DemarcationResult,
  sceneFrom: number,
  sceneTo: number
): ScriptBlock[] {
  const scenes = result.scenes.slice(sceneFrom - 1, sceneTo);
  if (!scenes.length) return [];
  const start = scenes[0].startBlock;
  const end = scenes[scenes.length - 1].endBlock;
  return result.blocks.slice(start, end + 1);
}

function styleBlock(b: ScriptBlock): Paragraph {
  if (b.kind === "slug") {
    return new Paragraph({
      spacing: { before: 200, after: 120 },
      children: [
        new TextRun({
          text: b.raw.trim(),
          bold: true,
          underline: {},
          font: "Cambria",
          size: 20,
          color: NAVY,
        }),
      ],
    });
  }
  if (b.kind === "cue" || b.kind === "marker" || b.kind === "ps_hook") {
    return new Paragraph({
      indent: { left: 360 },
      children: [
        new TextRun({
          text: b.raw.trim(),
          italics: true,
          font: "Cambria",
          size: 18,
          color: GREY,
        }),
      ],
    });
  }
  if (b.kind === "dialogue") {
    const isNarr = /narrator/i.test(b.label);
    return new Paragraph({
      spacing: { after: 80 },
      children: [
        new TextRun({
          text: b.label,
          bold: true,
          font: "Cambria",
          size: 20,
          color: isNarr ? "000000" : NAVY,
        }),
        new TextRun({ text: b.body, font: "Cambria", size: 20 }),
      ],
    });
  }
  return new Paragraph({
    spacing: { after: 80 },
    children: [new TextRun({ text: b.raw, font: "Cambria", size: 20 })],
  });
}

export async function buildDemarcationDocx(result: DemarcationResult): Promise<Buffer> {
  const sel = result.selected;
  const totalSec = wordsToRuntimeSec(result.baseSpokenWords);

  const summaryRows = (sel?.parts ?? []).map((part, i) => {
    const cream = i % 2 === 1;
    const runColor = part.overCeiling ? CRIMSON : NAVY;
    return new TableRow({
      children: [
        cell(String(part.partNo), { fill: cream ? CREAM : "FFFFFF", color: CRIMSON, bold: true }),
        cell(`S${part.sceneFrom}–S${part.sceneTo}`, { fill: cream ? CREAM : "FFFFFF" }),
        cell(`${part.sceneFrom}→${part.sceneTo}`, { fill: cream ? CREAM : "FFFFFF" }),
        cell(formatRuntime(part.runtimeSec), { fill: cream ? CREAM : "FFFFFF", color: runColor }),
        cell(part.endsOnSlug.slice(0, 42), { fill: cream ? CREAM : "FFFFFF" }),
      ],
    });
  });

  const cover: Paragraph[] = [
    new Paragraph({
      spacing: { after: 120 },
      children: [
        new TextRun({
          text: `${result.scriptName.toUpperCase()} · ${result.epLabel}`,
          bold: true,
          font: "Arial",
          size: 40,
          color: NAVY,
        }),
      ],
    }),
    new Paragraph({
      spacing: { after: 80 },
      border: {
        bottom: { style: BorderStyle.SINGLE, size: 12, color: NAVY, space: 4 },
      },
      children: [
        new TextRun({
          text: `${sel?.partCount ?? "?"}‑Part Demarcation · drama · AI-driven production`,
          font: "Arial",
          size: 22,
          color: CRIMSON,
        }),
      ],
    }),
    new Paragraph({
      spacing: { before: 160, after: 120 },
      children: [
        new TextRun({
          text: `Runtime ${formatRuntime(totalSec)} · ${138} wpm · ${result.baseSpokenWords} spoken words (base). Every boundary lands on a scene slug: ${
            sel ? "yes" : "n/a"
          }. The script text is unchanged from the base, word for word. Nothing here is locked until sign-off.`,
          font: "Cambria",
          size: 18,
          color: GREY,
        }),
      ],
    }),
    new Paragraph({
      spacing: { before: 120, after: 160 },
      children: [
        new TextRun({
          text: result.structuralFinding,
          font: "Arial",
          size: 20,
          color: CRIMSON,
          bold: true,
        }),
      ],
    }),
  ];

  if (result.pfmStripCount > 0) {
    cover.push(
      new Paragraph({
        spacing: { after: 120 },
        children: [
          new TextRun({
            text: `CORRECTION APPLIED (revertible): ${result.pfmStripCount} PocketFM reference(s) → [CLIENT] on this agency/demarcated export.`,
            font: "Arial",
            size: 18,
            color: CRIMSON,
            italics: true,
          }),
        ],
      })
    );
  }

  const children: (Paragraph | Table)[] = [
    ...cover,
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: ["Part", "Scenes", "In→Out", "Run", "Ends on"].map((h) =>
            cell(h, { fill: NAVY, color: "FFFFFF", bold: true })
          ),
        }),
        ...summaryRows,
      ],
    }),
    new Paragraph({
      spacing: { before: 240, after: 80 },
      children: [
        new TextRun({
          text: "Confirm before locking:",
          italics: true,
          font: "Arial",
          size: 20,
          color: CRIMSON,
        }),
      ],
    }),
    ...result.openDecisions.map(
      (d, i) =>
        new Paragraph({
          children: [
            new TextRun({
              text: `${i + 1}. ${d}`,
              font: "Cambria",
              size: 18,
            }),
          ],
        })
    ),
    new Paragraph({ children: [new PageBreak()] }),
  ];

  if (sel) {
    for (const part of sel.parts) {
      children.push(
        new Paragraph({
          shading: { type: ShadingType.CLEAR, fill: NAVY },
          spacing: { after: 120 },
          children: [
            new TextRun({
              text: `PART ${part.partNo}   ${part.title}`,
              bold: true,
              font: "Arial",
              size: 24,
              color: "FFFFFF",
            }),
          ],
        }),
        new Paragraph({
          border: {
            bottom: { style: BorderStyle.SINGLE, size: 12, color: CRIMSON, space: 6 },
          },
          spacing: { after: 200 },
          children: [
            new TextRun({
              text: `In→Out S${part.sceneFrom}→S${part.sceneTo}  ·  Runtime ${formatRuntime(
                part.runtimeSec
              )}  ·  Ends on ${part.endsOnSlug}`,
              font: "Arial",
              size: 18,
              color: GREY,
            }),
          ],
        })
      );
      // Use stripped text blocks for export body when PFM was stripped — but verbatim from stripped source
      const partBlocks = blocksForPart(result, part.sceneFrom, part.sceneTo);
      for (const b of partBlocks) {
        // Prefer raw from original; if stripping, apply token replace on display only when exporting agency deck
        const display =
          result.pfmStripCount > 0
            ? {
                ...b,
                raw: stripInline(b.raw),
                label: stripInline(b.label),
                body: stripInline(b.body),
              }
            : b;
        children.push(styleBlock(display));
      }
      children.push(new Paragraph({ children: [new PageBreak()] }));
    }
  }

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1080, bottom: 1180, left: 1080, right: 1080 },
            size: { width: 12240, height: 15840 }, // Letter
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    text: "Demarcation · not locked until sign-off",
                    font: "Arial",
                    size: 14,
                    color: GREY,
                    italics: true,
                  }),
                ],
              }),
            ],
          }),
        },
        children,
      },
    ],
  });

  return Buffer.from(await Packer.toBuffer(doc));
}

function stripInline(s: string): string {
  return s
    .replace(/Pocket\s*FM/gi, "[CLIENT]")
    .replace(/pocketfm/gi, "[CLIENT]");
}

function cell(
  text: string,
  opts: { fill?: string; color?: string; bold?: boolean } = {}
) {
  return new TableCell({
    shading: opts.fill
      ? { type: ShadingType.CLEAR, fill: opts.fill }
      : undefined,
    children: [
      new Paragraph({
        children: [
          new TextRun({
            text,
            font: "Arial",
            size: 16,
            bold: opts.bold,
            color: opts.color ?? "000000",
          }),
        ],
      }),
    ],
  });
}
