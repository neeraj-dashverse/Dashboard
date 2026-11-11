"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { OpsAction, OpsSnapshot } from "@/lib/ops/types";

type OpsContextValue = {
  snap: OpsSnapshot;
  busy: boolean;
  act: (action: OpsAction, opts?: { quiet?: boolean }) => Promise<void>;
  flush: () => Promise<void>;
  reset: () => Promise<void>;
};

const OpsContext = createContext<OpsContextValue | null>(null);

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

  const post = useCallback(async (body: Record<string, unknown>, quiet = false) => {
    if (!quiet) setBusy(true);
    try {
      const res = await fetch("/api/ops/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("action failed");
      const next = (await res.json()) as OpsSnapshot;
      setSnap((cur) => (cur.live && next.live === false ? cur : next));
    } finally {
      if (!quiet) setBusy(false);
    }
  }, []);

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
      act: canEdit ? (action, opts) => post({ action }, Boolean(opts?.quiet)) : blocked,
      flush: canEdit ? () => post({ flush: true }) : blocked,
      reset: () => post({ reset: true }),
    }),
    [snap, busy, post, canEdit, blocked]
  );

  return <OpsContext.Provider value={value}>{children}</OpsContext.Provider>;
}

export function useOps(): OpsContextValue {
  const ctx = useContext(OpsContext);
  if (!ctx) throw new Error("useOps must be used inside OpsProvider");
  return ctx;
}
