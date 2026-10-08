"use client";

import { useSyncExternalStore } from "react";

import { getServerSnapshot, getSnapshot, subscribe, type AppModeState } from "@/lib/appModeStore";

/** Live app mode: installed or not, lite mode, install prompt and update status. */
export function useAppMode(): AppModeState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
