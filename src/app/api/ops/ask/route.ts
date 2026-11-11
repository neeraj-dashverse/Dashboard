import { NextResponse } from "next/server";
import { leaveHistoryText } from "@/lib/ops/attendance-sheet";

/** Turns sheet facts into a short answer. Without GEMINI_API_KEY the page keeps the summary it already built. */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    question?: string;
    facts?: string;
    history?: { question: string; answer: string }[];
  } | null;
  const question = (body?.question ?? "").trim().slice(0, 1000);
  const facts = (body?.facts ?? "").trim().slice(0, 8000);
  const history = (body?.history ?? []).slice(-6);
  const key = process.env.GEMINI_API_KEY;
  if (!key || !question || !facts) return NextResponse.json({ summary: null });

  let savedLeave = "";
  if (/\bleave|attendance|available|who is working\b/i.test(question)) {
    savedLeave = await leaveHistoryText().catch(() => "");
  }

  const earlier = history
    .map((turn, index) => `Turn ${index + 1}\nQuestion: ${turn.question}\nAnswer: ${turn.answer}`)
    .join("\n\n");
  const prompt = [
    "You are the PocketFM ops assistant. The user can ask follow-up questions about the same promo or person.",
    "Use only the facts below. Do not invent dates, ratings, names, minutes, or reasons.",
    "When several parts share one date, say that once.",
    "The page already shows a table of part, artist, plot, productivity days, minutes, and quality. Refer to it instead of repeating every cell.",
    "Write two to four plain sentences.",
    "",
    earlier ? `Earlier in this conversation:\n${earlier}` : "",
    `Latest question: ${question}`,
    "",
    "Facts for the latest question:",
    facts,
    savedLeave ? `\nLeave saved on the Attendance log sheet, including older months:\n${savedLeave}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${encodeURIComponent(key)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 512 },
        }),
      }
    );
    if (!res.ok) return NextResponse.json({ summary: null });
    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const summary = data.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? "")
      .join("")
      .trim();
    return NextResponse.json({ summary: summary || null });
  } catch {
    return NextResponse.json({ summary: null });
  }
}
