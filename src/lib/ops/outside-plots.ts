/** Other in-house work that is not on the PocketFM tracker. Stored in this browser. */

export type OutsidePlot = {
  id: string;
  name: string;
  until: string;
  remark: string;
};

const KEY = "ops-outside-plots";

function personKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

export function loadOutsidePlots(): OutsidePlot[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(KEY) ?? "[]") as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((row): row is OutsidePlot => {
      if (!row || typeof row !== "object") return false;
      const item = row as Partial<OutsidePlot>;
      return Boolean(item.id && item.name && item.until);
    });
  } catch {
    return [];
  }
}

export function saveOutsidePlots(plots: OutsidePlot[]): void {
  window.localStorage.setItem(KEY, JSON.stringify(plots));
}

export function plotForName(plots: OutsidePlot[], name: string): OutsidePlot | undefined {
  const key = personKey(name);
  return [...plots]
    .filter((plot) => personKey(plot.name) === key)
    .sort((a, b) => b.until.localeCompare(a.until))[0];
}
