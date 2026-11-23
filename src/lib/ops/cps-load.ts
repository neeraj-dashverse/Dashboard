import { PFM_DROPDOWNS } from "./sheet-registry";
import { isOngoingPromo } from "./selectors";
import type { OpsSnapshot } from "./types";

export type CpsPromo = {
  id: string;
  title: string;
};

export type CpsLoad = {
  name: string;
  openPromos: CpsPromo[];
};

function splitCps(raw: string | null | undefined): string[] {
  return (raw ?? "")
    .split(/[,/&]+/)
    .map((name) => name.trim())
    .filter((name) => name.length > 1 && !/,/.test(name));
}

/** Who is a CP, and which open promos they already hold. Lightest load first. */
export function cpsLoad(snap: OpsSnapshot): CpsLoad[] {
  const names = new Set<string>();
  for (const name of PFM_DROPDOWNS.cps) names.add(name);
  for (const name of snap.cpsRoster) for (const part of splitCps(name)) names.add(part);
  for (const promo of snap.promos) for (const part of splitCps(promo.cps)) names.add(part);

  const rows: CpsLoad[] = [];
  for (const name of names) {
    const openPromos: CpsPromo[] = [];
    for (const promo of snap.promos) {
      if (!splitCps(promo.cps).some((part) => part.toLowerCase() === name.toLowerCase())) continue;
      if (!isOngoingPromo(snap, promo)) continue;
      openPromos.push({
        id: promo.id,
        title: [promo.showName, promo.promoName].filter(Boolean).join(" · "),
      });
    }
    rows.push({ name, openPromos });
  }

  return rows.sort((a, b) => a.openPromos.length - b.openPromos.length || a.name.localeCompare(b.name));
}
