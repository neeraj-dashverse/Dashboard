/**
 * Live Google Sheets read adapter.
 *
 * Primary promo list = Master Tracker (Neeraj's working copy).
 * Enriched by Production Tracker (parts), Pre Production Tracker (assets plan),
 * Master Productivity (quality), and the Assets spreadsheet (handoff links).
 *
 * Read-only for now: mutations still apply to the in-memory store (queued
 * pending writes), so the UI is fully interactive without touching the sheets.
 */
import type { OpsAdapter } from "./adapter";
import {
  DASHVERSE_PFM_SHEET,
  PFM_ASSETS_SHEET,
  PFM_TIMELINE_SHEET,
} from "./sheet-registry";
import { batchGet, hasSheetCredentials, normKey, splitNames, text, type Grid } from "./sheets-client";
import {
  buildAnimators,
  matchAsset,
  parseAssets,
  parseParts,
  parsePreProd,
  parsePromos,
  parseQuality,
  stubPromoFromAsset,
} from "./sheets-transform";
import {
  ensurePlannerTab,
  ensureRemarksTab,
  parsePlanner,
  parseRemarks,
  PLANNER_RANGE,
  REMARKS_RANGE,
  writePlannerCell,
  appendPlanRemark,
  syncPlanPart,
} from "./planner-sheet";
import {
  enqueueWrite,
  loadDismissedNudgeIds,
  loadPendingWrites,
  persistDismissNudge,
} from "./persistence";
import {
  applyAction,
  consumeLastWriteTarget,
  flushPendingWrites,
  getSnapshot,
  hasLiveHydration,
  hydrate,
  markLiveHydrated,
  setDismissedNudgeIds,
  setPendingWrites,
  dropPlanRemark,
} from "./store";
import { promoJoinKey, type OpsSnapshot, type Promo, type SheetSource, type TeamKind } from "./types";

const TIMELINE = PFM_TIMELINE_SHEET.spreadsheetId;
const ASSETS = PFM_ASSETS_SHEET.spreadsheetId;

const RANGES = {
  masterTracker: "'Master Tracker'!A1:O3000",
  productionTracker: "'Production Tracker'!A1:AF5000",
  preProduction: "'Pre Production Tracker'!A1:J3000",
  masterProductivity: "'Master Productivity'!A1:W5000",
  assets: "'Promos - Assets Master Sheet'!A1:AG3000",
};

function source(
  id: string,
  name: string,
  tab: string,
  url: string
): SheetSource {
  return { spreadsheetId: id, spreadsheetName: name, masterTab: tab, url };
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * The Master Tracker can legitimately list the same show+promo twice — e.g.
 * BTR · 6.0 - Contract Marriage has a Closed run and a separate WIP run. These
 * are DIFFERENT promos, not duplicates, so keep both as their own card.
 *
 * Only the join key collides. We keep one "primary" per key that owns the
 * shared key (so part / quality / pre-prod joins attach to it) and give any
 * siblings a suffixed id. The active (non-Closed) run is preferred as primary
 * so live parts land on the run that's still in progress; the Closed run keeps
 * its own Master Tracker totals as a historical card.
 */
function disambiguatePromos(promos: Promo[]): Promo[] {
  const groups = new Map<string, Promo[]>();
  for (const p of promos) {
    const arr = groups.get(p.id);
    if (arr) arr.push(p);
    else groups.set(p.id, [p]);
  }

  const out: Promo[] = [];
  for (const [, rows] of groups) {
    if (rows.length === 1) {
      out.push(rows[0]);
      continue;
    }
    const isClosed = (p: Promo) => Boolean(p.trackerStatus && /closed/i.test(p.trackerStatus));
    // Primary = first active (non-Closed) run; else the first row.
    const primaryIdx = rows.findIndex((p) => !isClosed(p));
    const primary = primaryIdx >= 0 ? primaryIdx : 0;
    rows.forEach((p, i) => {
      if (i === primary) {
        out.push(p);
      } else {
        out.push({ ...p, id: `${p.id}#${i + 1}` });
      }
    });
  }
  return out;
}

/** Planner + Remarks tabs are optional — one tab failing must not drop the other. */
async function loadPlanTabs(): Promise<{ planner: Grid; remarks: Grid }> {
  const read = async (range: string, ensure: () => Promise<unknown>): Promise<Grid> => {
    try {
      await ensure();
      const res = await batchGet(TIMELINE, [range]);
      return res[range] ?? [];
    } catch (err) {
      console.error("[ops] Plan tab load failed:", range, err);
      return [];
    }
  };
  const [planner, remarks] = await Promise.all([
    read(PLANNER_RANGE, ensurePlannerTab),
    read(REMARKS_RANGE, ensureRemarksTab),
  ]);
  return { planner, remarks };
}

export async function loadFromSheets(): Promise<OpsSnapshot> {
  const [timeline, assetsBook, planTabs] = await Promise.all([
    batchGet(TIMELINE, [
      RANGES.masterTracker,
      RANGES.productionTracker,
      RANGES.preProduction,
      RANGES.masterProductivity,
    ]),
    batchGet(ASSETS, [RANGES.assets]),
    loadPlanTabs(),
  ]);

  const trackerRows: Grid = timeline[RANGES.masterTracker] ?? [];
  const prodRows: Grid = timeline[RANGES.productionTracker] ?? [];
  const preProdRows: Grid = timeline[RANGES.preProduction] ?? [];
  const qualityRows: Grid = timeline[RANGES.masterProductivity] ?? [];
  const assetRows: Grid = assetsBook[RANGES.assets] ?? [];

  // Quality reviews first (also a source of animator names).
  const qualityReviews = parseQuality(qualityRows.slice(2));

  // Animator roster: derive from Production Tracker artist cells + quality.
  const partArtistCells: { names: string[]; team: TeamKind }[] = [];
  for (const r of prodRows) {
    const names = splitNames(r[7]);
    if (names.length === 0) continue;
    const team: TeamKind = /agency/i.test(String(r[6] ?? "")) ? "agency" : "in_house";
    partArtistCells.push({ names, team });
  }
  const qualityAnimators = qualityReviews.flatMap((q) => q.animators);
  const animators = buildAnimators(partArtistCells, qualityAnimators);
  const animatorIdByName = new Map<string, string>();
  for (const a of animators) animatorIdByName.set(normKey(a.name), a.id);

  const parts = parseParts(prodRows, animatorIdByName);
  const promos = disambiguatePromos(parsePromos(trackerRows));
  const preProd = parsePreProd(preProdRows);
  const assets = parseAssets(assetRows);

  // Enrich promos with pre-production + asset-team joins.
  // Siblings of a repeated promo carry a "#n" suffix on their id — strip it
  // back to the shared join key for the pre-prod lookup.
  const matchedAsset = new Set<string>();
  for (const promo of promos) {
    const baseId = promo.id.split("#")[0];
    promo.preProd = preProd.get(baseId) ?? null;
    const hit = matchAsset(promo, assets);
    promo.assetTeam = hit;
    if (hit) {
      const src = assets.find((a) => a.row === hit);
      if (src) matchedAsset.add(`${src.showKey}|${src.scriptKey}`);
    }
  }
  // Asset-sheet rows with no Master Tracker match still belong on Pre-production.
  for (const a of assets) {
    const k = `${a.showKey}|${a.scriptKey}`;
    if (matchedAsset.has(k)) continue;
    const id = promoJoinKey(a.showName, a.scriptName);
    const existing = promos.find((p) => p.id === id || p.id.startsWith(`${id}#`));
    if (existing) {
      if (!existing.assetTeam) existing.assetTeam = a.row;
      continue;
    }
    const stub = stubPromoFromAsset(a.showName, a.scriptName, a.row);
    stub.preProd = preProd.get(stub.id) ?? null;
    promos.push(stub);
  }

  return {
    today: todayIso(),
    live: true,
    source: source(
      DASHVERSE_PFM_SHEET.spreadsheetId,
      DASHVERSE_PFM_SHEET.spreadsheetName,
      DASHVERSE_PFM_SHEET.tabs.master.name,
      DASHVERSE_PFM_SHEET.url
    ),
    workingSource: source(
      PFM_TIMELINE_SHEET.spreadsheetId,
      PFM_TIMELINE_SHEET.spreadsheetName,
      PFM_TIMELINE_SHEET.tabs.masterTracker.name,
      PFM_TIMELINE_SHEET.url
    ),
    assetsSource: source(
      PFM_ASSETS_SHEET.spreadsheetId,
      PFM_ASSETS_SHEET.spreadsheetName,
      PFM_ASSETS_SHEET.tabs.promosAssetsMaster.name,
      PFM_ASSETS_SHEET.url
    ),
    // No separate daily-throughput spreadsheet exists; the Timeline
    // "Productivity Animation" tab is per-part quality, not a daily log.
    throughputSource: source(
      PFM_TIMELINE_SHEET.spreadsheetId,
      PFM_TIMELINE_SHEET.spreadsheetName,
      "Productivity Animation",
      `https://docs.google.com/spreadsheets/d/${PFM_TIMELINE_SHEET.spreadsheetId}/edit`
    ),
    promos,
    parts,
    animators,
    qualityReviews,
    dailyLogs: [],
    pendingWrites: [],
    dismissedNudgeIds: [],
    plannerCells: parsePlanner(planTabs.planner),
    planRemarks: parseRemarks(planTabs.remarks).reverse(),
    cpsRoster: [
      ...new Set(promos.map((p) => p.cps).filter((c): c is string => Boolean(c))),
    ].sort((a, b) => a.localeCompare(b)),
  };
}

/** Sheets snapshot + replay unsynced DB edits so refresh never loses work. */
async function hydrateFromSheetsAndDb(): Promise<OpsSnapshot> {
  const snap = await loadFromSheets();
  hydrate(snap);

  const [pending, dismissed] = await Promise.all([
    loadPendingWrites(),
    loadDismissedNudgeIds(),
  ]);
  setDismissedNudgeIds(dismissed);

  for (const write of pending) {
    applyAction(write.action, { recordWrite: false });
  }
  setPendingWrites(pending);

  markLiveHydrated();
  return getSnapshot();
}

export const sheetsAdapter: OpsAdapter = {
  async load() {
    // Always re-pull. Sheet edits (WIP status, new promos) must show on the
    // next page load — the old in-memory cache made the calendar look empty.
    return hydrateFromSheetsAndDb();
  },
  async act(action) {
    // Record only touches the Planner tab. Reloading every sheet first is what
    // made the click wait several seconds.
    if (action.type === "record_plan_part") {
      try {
        await syncPlanPart({
          showName: action.showName || "",
          promoName: action.promoName || "",
          promoId: action.promoId,
          partNo: action.partNo,
          updatedAt: new Date().toISOString().slice(0, 10),
          slots: action.slots,
        });
      } catch (err) {
        console.error("[ops] Plan record failed:", err);
        throw err;
      }
      if (hasLiveHydration()) {
        for (const slot of action.slots) {
          const re = new RegExp(slot.match, "i");
          const prev = getSnapshot().plannerCells.filter(
            (c) => c.promoId === action.promoId && c.partNo === action.partNo && re.test(c.text)
          );
          for (const old of prev) {
            if (old.date === slot.date && slot.date) continue;
            applyAction(
              {
                type: "set_plan_cell",
                promoId: action.promoId,
                partNo: action.partNo,
                date: old.date,
                text: "",
              },
              { recordWrite: false }
            );
          }
          if (slot.date.trim()) {
            applyAction(
              {
                type: "set_plan_cell",
                promoId: action.promoId,
                partNo: action.partNo,
                date: slot.date,
                text: slot.label,
                showName: action.showName,
                promoName: action.promoName,
              },
              { recordWrite: false }
            );
          }
        }
      }
      return getSnapshot();
    }

    // Each Vercel request starts empty. A plan save must not answer with the
    // sample promos, or the open promo page loses the row it just edited.
    if (!hasLiveHydration()) {
      await hydrateFromSheetsAndDb();
    }

    if (action.type === "dismiss_nudge") {
      await persistDismissNudge(action.nudgeId);
      applyAction(action, { recordWrite: false });
      return getSnapshot();
    }

    // Planner cells go straight to the Planner tab (no queue).
    if (action.type === "set_plan_cell") {
      const before = getSnapshot();
      const prev = before.plannerCells.find(
        (c) =>
          c.promoId === action.promoId && c.partNo === action.partNo && c.date === action.date
      );
      applyAction(action, { recordWrite: false });
      const promo = before.promos.find((p) => p.id === action.promoId);
      try {
        await writePlannerCell({
          showName: action.showName || promo?.showName || "",
          promoName: action.promoName || promo?.promoName || "",
          promoId: action.promoId,
          partNo: action.partNo,
          date: action.date,
          plan: action.text.trim(),
          updatedAt: before.today,
        });
      } catch (err) {
        console.error("[ops] Planner write failed — rolling back:", err);
        applyAction(
          { ...action, text: prev?.text ?? "" },
          { recordWrite: false }
        );
        throw err;
      }
      return getSnapshot();
    }

    if (action.type === "append_plan_remark") {
      const at = new Date().toISOString();
      applyAction({ ...action, at }, { recordWrite: false });
      const promo = getSnapshot().promos.find((p) => p.id === action.promoId);
      try {
        await appendPlanRemark({
          showName: action.showName || promo?.showName || "",
          promoName: action.promoName || promo?.promoName || "",
          promoId: action.promoId,
          partNo: action.partNo,
          body: action.body.trim(),
          at,
        });
      } catch (err) {
        console.error("[ops] Remark write failed — rolling back:", err);
        dropPlanRemark(action.promoId, at);
        throw err;
      }
      return getSnapshot();
    }

    // Mutate in memory (local pending row), then mirror into Supabase.
    applyAction(action);
    const target = consumeLastWriteTarget();
    if (target) {
      const row = await enqueueWrite(action, target);
      if (row) {
        const [, ...rest] = getSnapshot().pendingWrites;
        setPendingWrites([row, ...rest]);
      }
    }
    return getSnapshot();
  },
  async flushWrites() {
    // Gap 2 will push to Sheets then markWritesSynced. For now: mark local synced only.
    return flushPendingWrites();
  },
  async reset() {
    return hydrateFromSheetsAndDb();
  },
};

export { hasSheetCredentials };
