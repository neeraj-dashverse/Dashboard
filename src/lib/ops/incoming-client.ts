import type { IncomingPromo } from "./tasks";

type IncomingCache = {
  key: string;
  at: number;
  incoming: IncomingPromo[];
};

const TTL_MS = 60_000;
let cache: IncomingCache | null = null;
let inflight: Promise<IncomingPromo[]> | null = null;

function cacheKey(knownIds: string[]): string {
  return knownIds.slice().sort().join("|");
}

/** PocketFM incoming list — reused across Home / Workflow so tab changes do not re-hit Sheets. */
export function fetchIncoming(knownIds: string[]): Promise<IncomingPromo[]> {
  const key = cacheKey(knownIds);
  if (cache && cache.key === key && Date.now() - cache.at < TTL_MS) {
    return Promise.resolve(cache.incoming);
  }
  if (inflight) return inflight;
  inflight = fetch("/api/ops/incoming", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ knownIds }),
  })
    .then((res) => res.json() as Promise<{ incoming?: IncomingPromo[] }>)
    .then((data) => {
      const incoming = data.incoming ?? [];
      cache = { key, at: Date.now(), incoming };
      return incoming;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export function bustIncomingCache(): void {
  cache = null;
}
