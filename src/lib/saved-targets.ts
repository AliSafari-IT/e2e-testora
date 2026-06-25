// Named "saved targets" — a small address book for the Run page's Target
// environment. Each entry bundles the site + API base URLs and a snapshot of the
// product/company branding under a name, so recalling the name fills every field
// at once. Stored in localStorage (logos are data URLs, so it's self-contained).

import type { DomainBrand } from "@/lib/domain-logos";

export interface SavedTarget {
  id: string;
  name: string;
  baseUrl: string;
  apiUrl: string;
  brand?: DomainBrand;
  /** When this entry was last saved (ms epoch) — newest first in the list. */
  savedAt: number;
}

const STORAGE_KEY = "e2e_saved_targets";

export function getSavedTargets(): SavedTarget[] {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]") as SavedTarget[];
    return Array.isArray(raw) ? raw.slice().sort((a, b) => (b.savedAt ?? 0) - (a.savedAt ?? 0)) : [];
  } catch {
    return [];
  }
}

function write(list: SavedTarget[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    /* quota — ignore */
  }
}

/** Insert or replace by name (case-insensitive) or id; returns the new list. */
export function upsertSavedTarget(target: Omit<SavedTarget, "id" | "savedAt"> & { id?: string }): SavedTarget[] {
  const name = target.name.trim();
  const existing = getSavedTargets();
  const id =
    target.id ??
    existing.find((t) => t.name.trim().toLowerCase() === name.toLowerCase())?.id ??
    (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `t_${Date.now()}`);
  const entry: SavedTarget = {
    id,
    name,
    baseUrl: target.baseUrl,
    apiUrl: target.apiUrl,
    brand: target.brand,
    savedAt: Date.now(),
  };
  const next = [entry, ...existing.filter((t) => t.id !== id && t.name.trim().toLowerCase() !== name.toLowerCase())];
  write(next);
  return next;
}

export function removeSavedTarget(id: string): SavedTarget[] {
  const next = getSavedTargets().filter((t) => t.id !== id);
  write(next);
  return next;
}
