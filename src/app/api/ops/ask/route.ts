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
    "Use only the facts below. Do not invent dates, ratings, names, minutes, or reasons. If a fact is missing, say it is missing rather than guessing.",
    "Write for someone with zero context — a third person who has never seen this dashboard or these sheets should be able to read your answer alone and fully understand what happened, who is involved, what the numbers mean, and why it matters. Spell out names, show/promo titles, and what each number represents instead of assuming the reader already knows.",
    "Be thorough and specific: include the concrete numbers, dates, and names from the facts rather than vague summaries like 'performance is good'. When several parts share one date, say that once instead of repeating it.",
    "The page also shows a table with the same part/artist/plot/productivity/quality rows — you can reference it briefly, but do not use it as an excuse to skip detail; put the important numbers in your prose too.",
    "Write four to seven plain, complete sentences. Prefer being a little longer and clearer over being terse.",
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
          generationConfig: { temperature: 0.2, maxOutputTokens: 768 },
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
