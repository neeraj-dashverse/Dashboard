import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { AskReply } from "./ask";

type JsPdfWithAutoTable = jsPDF & { lastAutoTable?: { finalY: number } };

export type ReportTurn = {
  question: string;
  reply: AskReply;
};

const NAVY: [number, number, number] = [31, 42, 68];
const BLUE: [number, number, number] = [67, 97, 238];
const SLATE: [number, number, number] = [90, 98, 120];
const INK: [number, number, number] = [26, 30, 42];
const PAGE_MARGIN = 44;

function stamp(): string {
  return new Date().toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function drawCover(doc: jsPDF, title: string, subtitle: string) {
  const width = doc.internal.pageSize.getWidth();
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, width, 92, "F");
  doc.setFillColor(...BLUE);
  doc.rect(0, 92, width, 3, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("PocketFM Ops · Ask AI Report", PAGE_MARGIN, 40);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(200, 208, 230);
  doc.text(subtitle, PAGE_MARGIN, 60);
  doc.text(`Generated ${stamp()}`, PAGE_MARGIN, 76);
  void title;
}

function footer(doc: jsPDF) {
  const pageCount = doc.getNumberOfPages();
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  for (let page = 1; page <= pageCount; page++) {
    doc.setPage(page);
    doc.setDrawColor(226, 229, 238);
    doc.line(PAGE_MARGIN, height - 36, width - PAGE_MARGIN, height - 36);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...SLATE);
    doc.text("Generated from the live PocketFM Ops dashboard · Google Sheets + Gemini", PAGE_MARGIN, height - 22);
    doc.text(`Page ${page} of ${pageCount}`, width - PAGE_MARGIN, height - 22, { align: "right" });
  }
}

function writeTurn(doc: jsPDF, turn: ReportTurn, cursorStart: number, index: number): number {
  const width = doc.internal.pageSize.getWidth();
  const usable = width - PAGE_MARGIN * 2;
  let cursor = cursorStart;
  const pageBottom = doc.internal.pageSize.getHeight() - 56;

  const ensureRoom = (needed: number) => {
    if (cursor + needed > pageBottom) {
      doc.addPage();
      cursor = PAGE_MARGIN;
    }
  };

  ensureRoom(26);
  doc.setFillColor(...BLUE);
  doc.roundedRect(PAGE_MARGIN, cursor - 12, 18, 18, 3, 3, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text(String(index + 1), PAGE_MARGIN + 9, cursor + 1, { align: "center" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...SLATE);
  const question = doc.splitTextToSize(turn.question.toUpperCase(), usable - 26);
  doc.text(question, PAGE_MARGIN + 26, cursor);
  cursor += question.length * 12 + 6;

  ensureRoom(20);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...NAVY);
  doc.text(turn.reply.heading, PAGE_MARGIN, cursor);
  cursor += 16;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  doc.setTextColor(...INK);
  for (const line of turn.reply.lines) {
    const wrapped = doc.splitTextToSize(line, usable);
    ensureRoom(wrapped.length * 13 + 4);
    doc.text(wrapped, PAGE_MARGIN, cursor);
    cursor += wrapped.length * 13 + 4;
  }

  const tables = turn.reply.tables?.length ? turn.reply.tables : turn.reply.table ? [turn.reply.table] : [];
  for (const table of tables) {
    if (!table.rows.length) continue;
    ensureRoom(30);
    cursor += 4;
    if (table.title) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(...SLATE);
      doc.text(table.title.toUpperCase(), PAGE_MARGIN, cursor);
      cursor += 10;
    }
    autoTable(doc, {
      startY: cursor,
      margin: { left: PAGE_MARGIN, right: PAGE_MARGIN },
      head: [table.columns],
      body: table.rows,
      theme: "grid",
      styles: { font: "helvetica", fontSize: 8.5, cellPadding: 4, textColor: INK, lineColor: [226, 229, 238], lineWidth: 0.5 },
      headStyles: { fillColor: NAVY, textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [244, 246, 251] },
    });
    cursor = ((doc as JsPdfWithAutoTable).lastAutoTable?.finalY ?? cursor) + 14;
  }

  cursor += 10;
  ensureRoom(2);
  doc.setDrawColor(226, 229, 238);
  doc.line(PAGE_MARGIN, cursor - 6, width - PAGE_MARGIN, cursor - 6);
  return cursor + 6;
}

/** One question/answer, styled as a standalone PDF report. */
export function downloadTurnReport(turn: ReportTurn) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  drawCover(doc, "Ask AI report", turn.reply.heading);
  let cursor = 118;
  cursor = writeTurn(doc, turn, cursor, 0);
  void cursor;
  footer(doc);
  doc.save(`ask-ai-${slug(turn.reply.heading)}.pdf`);
}

/** The full thread, in order, as one designed report. */
export function downloadThreadReport(turns: ReportTurn[]) {
  if (!turns.length) return;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  drawCover(doc, "Ask AI report", `${turns.length} question${turns.length === 1 ? "" : "s"} answered from the sheets`);
  let cursor = 118;
  turns.forEach((turn, index) => {
    cursor = writeTurn(doc, turn, cursor, index);
  });
  footer(doc);
  doc.save(`ask-ai-thread-${new Date().toISOString().slice(0, 10)}.pdf`);
}

/** Plain-text version for pasting into Slack, email, etc. */
export function buildTurnText(turn: ReportTurn): string {
  const lines = [turn.question.toUpperCase(), "", turn.reply.heading, "", ...turn.reply.lines];
  const tables = turn.reply.tables?.length ? turn.reply.tables : turn.reply.table ? [turn.reply.table] : [];
  for (const table of tables) {
    if (!table.rows.length) continue;
    lines.push("", table.title ? table.title.toUpperCase() : "", table.columns.join(" | "));
    lines.push(table.columns.map(() => "---").join(" | "));
    for (const row of table.rows) lines.push(row.join(" | "));
  }
  return lines.join("\n");
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "report";
}
