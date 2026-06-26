// Project (app) registry — testora can hold the test catalogs of several apps
// at once. Every functional requirement carries a `projectId`; the Run page and
// the Cases/Fixtures/Suites lists filter the whole catalog by the active
// project, and selecting a project pre-fills the Target environment (URLs +
// branding) from its defaults. This is what makes "point at a different domain"
// run that domain's OWN tests instead of another app's.
//
// Add a new app by appending an entry here and tagging its requirements with the
// matching `projectId` (see how the seed bundles set it).

export interface ProjectDef {
  /** Stable slug stored on each functional requirement's `projectId`. */
  id: string;
  /** Human label shown in the App selector. */
  name: string;
  /** Default site origin pre-filled into the Target environment. */
  baseUrl: string;
  /** Default API base pre-filled into the Target environment. */
  apiUrl: string;
  /** Optional default branding for exported reports. */
  brand?: { productName?: string; companyName?: string };
}

// The catalog that shipped first (admin, scraper, video-gen, contact, …). Kept
// deliberately un-named in source — the display name comes from env so a real
// product name never leaks into this repo. Defaults point at localhost / the
// generic NEXT_PUBLIC_WEBAPP_* values.
const WEBAPP_PROJECT: ProjectDef = {
  id: "webapp",
  name: process.env.NEXT_PUBLIC_WEBAPP_NAME || "Web app (default)",
  baseUrl: process.env.NEXT_PUBLIC_WEBAPP_BASE_URL || "http://localhost:3233",
  apiUrl:
    process.env.NEXT_PUBLIC_WEBAPP_API_URL || "http://localhost:3234/api/v1",
};

// ASafariM Portal — the maintainer's own site, so it's fine to name directly.
const ASAFARIM_PORTAL: ProjectDef = {
  id: "asafarim",
  name: "ASafariM Portal",
  baseUrl: process.env.NEXT_PUBLIC_ASAFARIM_BASE_URL || "https://portal.asafarim.com",
  apiUrl: process.env.NEXT_PUBLIC_ASAFARIM_API_URL || "https://portal.asafarim.com/api",
  brand: { productName: "ASafariM", companyName: "ASafariM" },
};

export const PROJECTS: ProjectDef[] = [WEBAPP_PROJECT, ASAFARIM_PORTAL];

/** The catalog every existing requirement is tagged with. */
export const DEFAULT_PROJECT_ID = WEBAPP_PROJECT.id;

export function getProject(id: string | null | undefined): ProjectDef | undefined {
  return PROJECTS.find((p) => p.id === id);
}
