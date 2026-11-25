import type { CreditUsage, OpsSnapshot, Part, Promo } from "./types";
import { byLatestPromo, isOngoingPromo } from "./selectors";

export type AgencyPartPack = {
  partNo: number;
  durationSec: number;
  artist: string | null;
  deadline: string | null;
  stage: Part["stage"];
  status: string | null;
  open: boolean;
};

export type AgencyHandoff = {
  promoId: string;
  showName: string;
  promoName: string;
  sheetIndex: number;
  cps: string | null;
  deadline: string | null;
  trackerStatus: string | null;
  priority: Promo["priority"];
  agencyParts: AgencyPartPack[];
  inHouseParts: number;
  totalParts: number;
  openAgencyParts: number;
  agencyDurationSec: number;
  scriptLink: string | null;
  agencyScriptLink: string | null;
  demarcatedScriptLink: string | null;
  frameioLink: string | null;
  assetsDriveLink: string | null;
  assetMapLink: string | null;
  creditUsage: CreditUsage | null;
  missing: string[];
};

function firstUrl(...candidates: (string | null | undefined)[]): string | null {
  for (const value of candidates) {
    const url = value?.trim();
    if (url) return url;
  }
  return null;
}

function frameioLink(promo: Promo, snap: OpsSnapshot): string | null {
  const reviews = snap.qualityReviews.filter((row) => row.promoId === promo.id);
  const reviewLinks = reviews.map((row) => row.krockLink);
  const candidates = [
    promo.krockLink5Min,
    promo.canvasLink,
    promo.assetTeam?.assetCanvasLink,
    promo.showLink,
    promo.videoSamples,
    ...reviewLinks,
  ];
  const frame = candidates.find((url) => url && /frame\.io/i.test(url));
  if (frame) return frame;
  return firstUrl(...candidates.filter((url) => url && /krock\.io|frame/i.test(url)), ...candidates);
}

function earliestDate(values: (string | null | undefined)[]): string | null {
  const dates = values.filter((value): value is string => Boolean(value && /^\d{4}-\d{2}-\d{2}/.test(value)));
  if (dates.length === 0) return null;
  return dates.sort()[0];
}

function packPart(part: Part): AgencyPartPack {
  return {
    partNo: part.partNo,
    durationSec: part.durationSec,
    artist: part.artist,
    deadline: part.deadline ?? part.plannedDate,
    stage: part.stage,
    status: part.status,
    open: part.stage !== "delivered",
  };
}

export function agencyHandoffs(snap: OpsSnapshot, opts?: { allOpen?: boolean }): AgencyHandoff[] {
  const rows: AgencyHandoff[] = [];
  for (const promo of snap.promos) {
    if (!isOngoingPromo(snap, promo)) continue;
    const parts = snap.parts
      .filter((part) => part.promoId === promo.id)
      .sort((a, b) => a.partNo - b.partNo);
    const agencyParts = parts.filter((part) => part.team === "agency").map(packPart);
    if (!opts?.allOpen && agencyParts.length === 0) continue;

    const scriptLink = firstUrl(promo.workingScriptLink, promo.scriptLink);
    const agencyScriptLink = firstUrl(promo.agencyScriptLink);
    const demarcatedScriptLink = firstUrl(promo.demarcatedScriptLink);
    const frame = frameioLink(promo, snap);
    const assetsDriveLink = firstUrl(promo.assetTeam?.assetsDriveLink, promo.assetsLink);
    const assetMapLink = firstUrl(promo.assetTeam?.assetMapLink);
    const deadline = earliestDate([
      ...agencyParts.filter((part) => part.open).map((part) => part.deadline),
      ...agencyParts.map((part) => part.deadline),
      promo.completeDeliverable,
      promo.fiveMinTimeline,
      promo.deliveryDate,
    ]);

    const missing: string[] = [];
    if (!scriptLink) missing.push("Script");
    if (!agencyScriptLink) missing.push("Agency script");
    if (!demarcatedScriptLink) missing.push("Demarcated script");
    if (!frame) missing.push("Frame.io");
    if (!assetsDriveLink) missing.push("Asset drive");
    if (!assetMapLink) missing.push("Asset map");
    if (!promo.cps) missing.push("CP");
    if (agencyParts.length > 0 && !deadline) missing.push("Deadline");

    rows.push({
      promoId: promo.id,
      showName: promo.showName,
      promoName: promo.promoName,
      sheetIndex: promo.sheetIndex,
      cps: promo.cps,
      deadline,
      trackerStatus: promo.trackerStatus,
      priority: promo.priority,
      agencyParts,
      inHouseParts: parts.filter((part) => part.team !== "agency").length,
      totalParts: parts.length,
      openAgencyParts: agencyParts.filter((part) => part.open).length,
      agencyDurationSec: agencyParts.reduce((sum, part) => sum + (part.durationSec || 0), 0),
      scriptLink,
      agencyScriptLink,
      demarcatedScriptLink,
      frameioLink: frame,
      assetsDriveLink,
      assetMapLink,
      creditUsage: promo.creditUsage,
      missing,
    });
  }

  return rows.sort((a, b) => byLatestPromo(a, b) || a.showName.localeCompare(b.showName));
}

export function agencySummary(rows: AgencyHandoff[]) {
  const agencyParts = rows.reduce((sum, row) => sum + row.agencyParts.length, 0);
  const openAgencyParts = rows.reduce((sum, row) => sum + row.openAgencyParts, 0);
  const missingFiles = rows.filter((row) => row.missing.length > 0).length;
  const nextDeadline = earliestDate(rows.map((row) => row.deadline));
  return { promos: rows.length, agencyParts, openAgencyParts, missingFiles, nextDeadline };
}
