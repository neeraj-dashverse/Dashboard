"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { bustIncomingCache } from "@/lib/ops/incoming-client";
import type { OpsAction, OpsSnapshot } from "@/lib/ops/types";

const SNAP_KEY = "ops-snap-v1";

type OpsContextValue = {
  snap: OpsSnapshot;
  busy: boolean;
  booting: boolean;
  act: (action: OpsAction, opts?: { quiet?: boolean }) => Promise<void>;
  flush: () => Promise<void>;
  reset: () => Promise<void>;
};

const OpsContext = createContext<OpsContextValue | null>(null);

function readCachedSnap(): OpsSnapshot | null {
  try {
    const raw = sessionStorage.getItem(SNAP_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as OpsSnapshot;
    return parsed?.live ? parsed : null;
  } catch {
    return null;
  }
}

function writeCachedSnap(snap: OpsSnapshot) {
  if (!snap.live) return;
  try {
    sessionStorage.setItem(SNAP_KEY, JSON.stringify(snap));
  } catch {
    /* quota — keep going in memory */
  }
}

export function OpsProvider({
  initial,
  canEdit = true,
  children,
}: {
  initial: OpsSnapshot;
  /** Viewers can still refresh (reset), but every write action (act/flush) is a no-op with a notice. */
  canEdit?: boolean;
  children: ReactNode;
}) {
  const [snap, setSnap] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [booting, setBooting] = useState(!initial.live);

  const applySnap = useCallback((next: OpsSnapshot) => {
    setSnap((cur) => {
      if (cur.live && next.live === false) return cur;
      writeCachedSnap(next);
      return next;
    });
  }, []);

  useEffect(() => {
    const cached = readCachedSnap();
    if (cached) {
      setSnap(cached);
      setBooting(false);
    }

    let cancelled = false;
    fetch("/api/ops/action")
      .then((res) => {
        if (!res.ok) throw new Error("snapshot failed");
        return res.json() as Promise<OpsSnapshot>;
      })
      .then((next) => {
        if (cancelled) return;
        applySnap(next);
        setBooting(false);
      })
      .catch(() => {
        if (!cancelled) setBooting(false);
      });
    return () => {
      cancelled = true;
    };
  }, [applySnap]);

  const post = useCallback(
    async (body: Record<string, unknown>, quiet = false) => {
      if (!quiet) setBusy(true);
      try {
        const res = await fetch("/api/ops/action", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error("action failed");
        const next = (await res.json()) as OpsSnapshot;
        applySnap(next);
      } finally {
        if (!quiet) setBusy(false);
      }
    },
    [applySnap]
  );

  const blocked = useCallback(() => {
    if (typeof window !== "undefined") {
      window.alert("You have view-only access. Ask Neeraj for edit access to make changes.");
    }
    return Promise.resolve();
  }, []);

  const value = useMemo<OpsContextValue>(
    () => ({
      snap,
      busy,
      booting,
      act: canEdit ? (action, opts) => post({ action }, Boolean(opts?.quiet)) : blocked,
      flush: canEdit ? () => post({ flush: true }) : blocked,
      reset: () => {
        bustIncomingCache();
        return post({ reset: true });
      },
    }),
    [snap, busy, booting, post, canEdit, blocked]
  );

  return <OpsContext.Provider value={value}>{children}</OpsContext.Provider>;
}

export function BootGate({ children }: { children: ReactNode }) {
  const { snap, booting } = useOps();
  if (booting && !snap.live) {
    return (
      <div className="flex h-full min-h-[40vh] flex-col items-center justify-center gap-2 text-center">
        <p className="text-sm font-semibold text-white">Loading live sheets…</p>
        <p className="text-[12px] text-slate-500">This waits once. Moving between tabs stays instant.</p>
      </div>
    );
  }
  return children;
}

export function useOps(): OpsContextValue {
  const ctx = useContext(OpsContext);
  if (!ctx) throw new Error("useOps must be used inside OpsProvider");
  return ctx;
}
