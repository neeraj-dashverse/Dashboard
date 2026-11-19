import { NextResponse } from "next/server";
import { leaveHistoryText } from "@/lib/ops/attendance-sheet";

/** Turns sheet facts into a short answer. Without GEMINI_API_KEY the page keeps the summary it already built. */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    question?: string;
    facts?: string;
    history?: { question: string; answer: string }[];
    intent?: string;
  } | null;
  const question = (body?.question ?? "").trim().slice(0, 1000);
  const facts = (body?.facts ?? "").trim().slice(0, 8000);
  const history = (body?.history ?? []).slice(-6);
  const intent = (body?.intent ?? "").trim();
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
    "You pass information to people who already run this work. They know the sheets, the stages, and the process. Do not explain any of that.",
    "Use only the facts below. Do not invent dates, names, ratings, or durations.",
    intent ? `This question is about: ${intent}. Answer that, and only that, from the facts.` : "",
    "If the facts give a list of names or promos, repeat the actual names. Never summarize a list to 'everyone', 'all', 'most', or 'the team'.",
    "Availability answers must keep four buckets if present: free for new work, on leave today, still plotted, should-be-free/overdue.",
    "Do not drop a plotted person when saying who is free.",
    "For one person or one promo, one to three short sentences. For a list question, keep the list.",
    "Do not mention anything that is empty, missing, or not filled in, unless the question asks whether it is missing.",
    "Do not mention power start unless the question asks about power start.",
    "Do not mention ratings unless the facts include a rating. Do not invent an average.",
    "",
    earlier ? `Earlier in this conversation:\n${earlier}` : "",
    `Latest question: ${question}`,
    "",
    "Facts for the latest question (lines first, then any tables):",
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
          generationConfig: { temperature: 0.2, maxOutputTokens: 600 },
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
