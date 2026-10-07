export type PaperSize = "a4" | "letter" | "legal" | "a5";
export type PageOrientation = "portrait" | "landscape";

export interface PageSettings {
  size: PaperSize;
  orientation: PageOrientation;
  /** Margin on all four sides, in millimetres. */
  marginMm: number;
  pageNumbers: boolean;
  /** Optional text printed at the top of every page. */
  headerText: string;
  /** Optional text printed at the bottom of every page, next to the page number. */
  footerText: string;
  /** Where header / footer text sits. Variables such as {page} and {pages} are filled in per page. */
  headerAlign: TextAlign;
  footerAlign: TextAlign;
}

export type TextAlign = "left" | "center" | "right";

export const DEFAULT_PAGE: PageSettings = {
  size: "a4",
  orientation: "portrait",
  marginMm: 25.4,
  pageNumbers: true,
  headerText: "",
  footerText: "",
  headerAlign: "left",
  footerAlign: "center",
};

/** Portrait dimensions in millimetres. */
export const PAPER_MM: Record<PaperSize, { width: number; height: number; label: string }> = {
  a4: { width: 210, height: 297, label: "A4" },
  letter: { width: 215.9, height: 279.4, label: "US Letter" },
  legal: { width: 215.9, height: 355.6, label: "US Legal" },
  a5: { width: 148, height: 210, label: "A5" },
};

/** Page size in mm after applying orientation. */
export function pageDimensionsMm(page: Pick<PageSettings, "size" | "orientation">): { width: number; height: number } {
  const { width, height } = PAPER_MM[page.size];
  return page.orientation === "landscape" ? { width: height, height: width } : { width, height };
}

export const mmToTwips = (mm: number): number => Math.round((mm / 25.4) * 1440);
export const mmToPx = (mm: number): number => (mm / 25.4) * 96;
