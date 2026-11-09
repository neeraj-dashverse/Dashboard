import { NextResponse } from "next/server";

/** Turns sheet facts into a short answer. Without GEMINI_API_KEY the page keeps the summary it already built. */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { question?: string; facts?: string } | null;
  const question = (body?.question ?? "").trim().slice(0, 1000);
  const facts = (body?.facts ?? "").trim().slice(0, 8000);
  const key = process.env.GEMINI_API_KEY;
  if (!key || !question || !facts) return NextResponse.json({ summary: null });

  const prompt = [
    "You are the PocketFM ops assistant.",
    "Use only the facts below. Do not invent dates, ratings, names, or reasons.",
    "When several parts share one date, say that once. Do not repeat the same day as if it were different.",
    "Write one short summary, plain sentences, no bullet list.",
    "",
    `Question: ${question}`,
    "",
    "Facts:",
    facts,
  ].join("\n");

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
