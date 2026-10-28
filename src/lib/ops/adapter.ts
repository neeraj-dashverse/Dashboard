/**
 * Data adapter boundary.
 *
 * Today: in-memory mock store.
 * Later: implement SheetsAdapter that reads Master / PocketFM / Assets tabs
 * and writes mutations back to the correct columns (not a side Updates tab).
 */

import { applyAction, flushPendingWrites, getSnapshot, hasLiveHydration, resetToMock } from "./store";
import type { OpsAction, OpsSnapshot } from "./types";

export interface OpsAdapter {
  load(): Promise<OpsSnapshot>;
  act(action: OpsAction): Promise<OpsSnapshot>;
  flushWrites(): Promise<OpsSnapshot>;
  reset?(): Promise<OpsSnapshot>;
}

export const mockAdapter: OpsAdapter = {
  async load() {
    return getSnapshot();
  },
  async act(action) {
    return applyAction(action);
  },
  async flushWrites() {
    return flushPendingWrites();
  },
  async reset() {
    return resetToMock();
  },
};

/**
 * Live by default when service-account creds are present. Falls back to mock
 * (and never crashes the UI) if a live load fails. Force mock with
 * OPS_DATA_SOURCE=mock.
 */
function selectAdapter(): OpsAdapter {
  if (process.env.OPS_DATA_SOURCE === "mock") return mockAdapter;
  const hasCreds =
    Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL) &&
    Boolean(process.env.GOOGLE_PRIVATE_KEY);
  if (!hasCreds) return mockAdapter;

  // Lazy require avoids pulling googleapis into the mock path / client bundles.
  const { sheetsAdapter, loadFromSheets } = require("./sheets-adapter") as typeof import("./sheets-adapter");

  const guarded: OpsAdapter = {
    async load() {
      try {
        return await sheetsAdapter.load();
      } catch (err) {
        console.error("[ops] live Sheets load failed — keeping the last live copy:", err);
        if (hasLiveHydration()) return getSnapshot();
        return mockAdapter.load();
      }
    },
    act: sheetsAdapter.act,
    flushWrites: sheetsAdapter.flushWrites,
    async reset() {
      try {
        return await (sheetsAdapter.reset?.() ?? sheetsAdapter.load());
      } catch (err) {
        console.error("[ops] live Sheets reset failed — serving mock:", err);
        return mockAdapter.reset ? mockAdapter.reset() : mockAdapter.load();
      }
    },
  };
  // Touch loadFromSheets so tree-shakers keep it available for scripts.
  void loadFromSheets;
  return guarded;
}

export const opsAdapter: OpsAdapter = selectAdapter();
