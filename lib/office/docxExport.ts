import {
  AlignmentType,
  BorderStyle,
  Document,
  ExternalHyperlink,
  Footer,
  Header,
  HeadingLevel,
  LevelFormat,
  Packer,
  PageNumber,
  PageOrientation as DocxOrientation,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  type ParagraphChild,
} from "docx";

import type { Block, Inline } from "@/lib/office/docModel";
import type { DocTheme } from "@/lib/office/docThemes";
import { PAPER_MM, mmToTwips, type PageSettings } from "@/lib/office/pageSettings";

const HEADINGS = [
  HeadingLevel.HEADING_1,
  HeadingLevel.HEADING_2,
  HeadingLevel.HEADING_3,
  HeadingLevel.HEADING_4,
  HeadingLevel.HEADING_5,
  HeadingLevel.HEADING_6,
] as const;

const MONO = "Courier New";
const SAFE_LINK = /^(https?:|mailto:)/i;

interface RunStyle {
  size?: number;
  color?: string;
  bold?: boolean;
  italics?: boolean;
}

function runsToChildren(runs: Inline[], theme: DocTheme, base: RunStyle = {}): ParagraphChild[] {
  const children: ParagraphChild[] = [];
  for (const run of runs) {
    // "\n" inside a run becomes a Word line break.
    const parts = run.text.split("\n");
    const textRuns = parts.map(
      (part, i) =>
        new TextRun({
          text: part,
          break: i > 0 ? 1 : undefined,
          bold: run.bold || base.bold,
          italics: run.italic || base.italics,
          font: run.code ? MONO : undefined,
          size: base.size,
          color: run.href ? theme.link : base.color,
          underline: run.href ? {} : undefined,
          shading: run.code ? { type: ShadingType.CLEAR, fill: theme.codeBg, color: "auto" } : undefined,
        })
    );
    if (run.href && SAFE_LINK.test(run.href.trim())) {
      children.push(new ExternalHyperlink({ link: run.href.trim(), children: textRuns }));
    } else {
      children.push(...textRuns);
    }
  }
  return children;
}

function numberingConfig() {
  const levels = (format: (typeof LevelFormat)[keyof typeof LevelFormat], texts: string[]) =>
    texts.map((text, level) => ({
      level,
      format,
      text,
      alignment: AlignmentType.LEFT,
      style: { paragraph: { indent: { left: 720 + level * 360, hanging: 360 } } },
    }));
  return {
    bullets: levels(LevelFormat.BULLET, ["•", "–", "▪"]),
    numbers: levels(LevelFormat.DECIMAL, ["%1.", "%2.", "%3."]),
  };
}

function blockToElements(block: Block, theme: DocTheme, listInstance: { next: () => number }): (Paragraph | Table)[] {
  const after = Math.round(theme.paragraphSpacing * 20);
  switch (block.type) {
    case "heading":
      return [new Paragraph({ heading: HEADINGS[block.level - 1], children: runsToChildren(block.runs, theme) })];
    case "paragraph":
      return [new Paragraph({ spacing: { after }, children: runsToChildren(block.runs, theme) })];
    case "quote":
      return [
        new Paragraph({
          spacing: { after },
          indent: { left: 360 },
          border: { left: { style: BorderStyle.SINGLE, size: 18, color: theme.accent, space: 10 } },
          children: runsToChildren(block.runs, theme, { italics: true }),
        }),
      ];
    case "code":
      return block.text.split("\n").map(
        (line) =>
          new Paragraph({
            spacing: { after: 0 },
            shading: { type: ShadingType.CLEAR, fill: theme.codeBg, color: "auto" },
            children: [new TextRun({ text: line || " ", font: MONO, size: Math.round(theme.baseSize * 0.9 * 2) })],
          })
      );
    case "image":
      // Pictures aren't embedded in Word output yet; the PDF path supports them.
      return [];
    case "rule":
      return [
        new Paragraph({
          spacing: { after },
          border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: theme.tableBorder, space: 1 } },
        }),
      ];
    case "list": {
      const instance = block.ordered ? listInstance.next() : 0;
      return block.items.map(
        (item) =>
          new Paragraph({
            spacing: { after: 60 },
            numbering: { reference: block.ordered ? "numbers" : "bullets", level: item.level, instance },
            children: runsToChildren(item.runs, theme),
          })
      );
    }
    case "table": {
      const border = { style: BorderStyle.SINGLE, size: 4, color: theme.tableBorder };
      const borders = { top: border, bottom: border, left: border, right: border };
      const makeRow = (cells: Inline[][], header: boolean) =>
        new TableRow({
          tableHeader: header,
          children: cells.map(
            (cell) =>
              new TableCell({
                borders,
                margins: { top: 60, bottom: 60, left: 100, right: 100 },
                shading: header ? { type: ShadingType.CLEAR, fill: theme.tableHeaderBg, color: "auto" } : undefined,
                children: [
                  new Paragraph({
                    children: runsToChildren(cell, theme, header ? { bold: true, color: theme.tableHeaderText } : {}),
                  }),
                ],
              })
          ),
        });
      const rows = [...(block.header ? [makeRow(block.header, true)] : []), ...block.rows.map((r) => makeRow(r, false))];
      if (rows.length === 0) return [];
      return [new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows }), new Paragraph({ spacing: { after } })];
    }
  }
}

function headingStyle(theme: DocTheme, level: number) {
  return {
    id: `Heading${level}`,
    name: `Heading ${level}`,
    basedOn: "Normal",
    next: "Normal",
    quickFormat: true,
    run: { font: theme.headingFont, size: Math.round(theme.headingSizes[level - 1] * 2), bold: true, color: theme.headingColor },
    paragraph: {
      spacing: { before: Math.round(theme.paragraphSpacing * 28), after: Math.round(theme.paragraphSpacing * 12) },
      keepNext: true,
      ...(level === 1
        ? { border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: theme.accent, space: 2 } } }
        : {}),
    },
  };
}

/** Builds a real .docx whose styles, lists, tables, links and page setup come from the shared model and theme. */
export async function blocksToDocxBlob(blocks: Block[], theme: DocTheme, page: PageSettings): Promise<Blob> {
  const paper = PAPER_MM[page.size];
  const margin = mmToTwips(page.marginMm);
  let instance = 0;
  const listInstance = { next: () => ++instance };

  const children = blocks.flatMap((block) => blockToElements(block, theme, listInstance));
  if (children.length === 0) children.push(new Paragraph({}));

  const footerChildren: ParagraphChild[] = [];
  if (page.footerText.trim()) footerChildren.push(new TextRun({ text: page.footerText.trim() + (page.pageNumbers ? "   ·   " : "") }));
  if (page.pageNumbers) footerChildren.push(new TextRun({ children: [PageNumber.CURRENT] }));

  const doc = new Document({
    creator: "EveryUtili",
    styles: {
      default: {
        document: {
          run: { font: theme.font, size: Math.round(theme.baseSize * 2), color: theme.text },
          paragraph: { spacing: { line: Math.round(theme.lineHeight * 240) } },
        },
      },
      paragraphStyles: [1, 2, 3, 4, 5, 6].map((level) => headingStyle(theme, level)),
    },
    numbering: { config: [{ reference: "bullets", levels: numberingConfig().bullets }, { reference: "numbers", levels: numberingConfig().numbers }] },
    sections: [
      {
        properties: {
          page: {
            size: { width: mmToTwips(paper.width), height: mmToTwips(paper.height), orientation: page.orientation === "landscape" ? DocxOrientation.LANDSCAPE : DocxOrientation.PORTRAIT },
            margin: { top: margin, bottom: margin, left: margin, right: margin },
          },
        },
        headers: page.headerText.trim()
          ? { default: new Header({ children: [new Paragraph({ children: [new TextRun({ text: page.headerText.trim(), color: "6B7280", size: 18 })] })] }) }
          : undefined,
        footers:
          footerChildren.length > 0
            ? { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: footerChildren })] }) }
            : undefined,
        children,
      },
    ],
  });
  return Packer.toBlob(doc);
}
