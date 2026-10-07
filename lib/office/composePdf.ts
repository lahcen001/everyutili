import type { DocTheme } from "@/lib/office/docThemes";
import { addHeadingIds, coverHtml, pageContentHeightPx, pageIndexAt, printedPage, tocHtml, type CoverOptions, type TocEntry, type TocOptions } from "@/lib/office/composeDocument";
import type { PageSettings } from "@/lib/office/pageSettings";
import { layoutDocument, type PdfLayout } from "@/lib/office/pdfExport";

export interface ComposeInput {
  bodyHtml: string;
  theme: DocTheme;
  page: PageSettings;
  fontSizePt?: number;
  cover: CoverOptions;
  toc: TocOptions;
}

export interface Composed {
  /** cover + contents + body, ready to paginate and render */
  html: string;
  layout: PdfLayout;
  /** unnumbered pages at the start */
  coverPages: number;
  entries: TocEntry[];
}

/**
 * Builds the complete document (cover, contents, body) and its page layout. The contents page needs page
 * numbers that depend on the layout, so it is measured once with placeholders of the same width, then filled in.
 */
export async function composeDocument(input: ComposeInput): Promise<Composed> {
  const { theme, page, cover, toc } = input;
  const heightPx = pageContentHeightPx(page);
  const withIds = toc.enabled ? addHeadingIds(input.bodyHtml, toc.maxLevel) : { html: input.bodyHtml, entries: [] as TocEntry[] };
  const coverPart = coverHtml(cover, heightPx, theme);
  const coverPages = coverPart ? 1 : 0;
  const build = (pages: (number | string)[]) => `${coverPart}${tocHtml(withIds.entries, pages, toc.title)}${withIds.html}`;

  const placeholder = withIds.entries.map(() => "00");
  const first = build(placeholder);
  const layout = await layoutDocument(first, theme, page, input.fontSizePt);
  if (withIds.entries.length === 0) return { html: first, layout, coverPages, entries: [] };

  const numbers = withIds.entries.map((e) => printedPage(pageIndexAt(layout.slices, layout.marks[e.id] ?? 0), coverPages));
  // only the digits change, so the first layout still applies
  return { html: build(numbers), layout, coverPages, entries: withIds.entries };
}
