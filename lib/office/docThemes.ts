/** A document look shared by the Word export (styles), the live preview and the PDF output (CSS). */
export interface DocTheme {
  id: string;
  name: string;
  description: string;
  font: string;
  /** CSS fallback list used for preview/PDF. */
  cssFont: string;
  headingFont: string;
  /** Body size in points. */
  baseSize: number;
  /** Line height as a multiple of the font size. */
  lineHeight: number;
  /** Space after a paragraph, in points. */
  paragraphSpacing: number;
  /** Heading sizes in points for h1–h6. */
  headingSizes: [number, number, number, number, number, number];
  text: string;
  headingColor: string;
  accent: string;
  link: string;
  tableHeaderBg: string;
  tableHeaderText: string;
  tableBorder: string;
  codeBg: string;
}

export const DOC_THEMES: DocTheme[] = [
  {
    id: "clean", name: "Clean", description: "Calibri, friendly blue headings",
    font: "Calibri", cssFont: "Calibri, Carlito, Arial, sans-serif", headingFont: "Calibri",
    baseSize: 11, lineHeight: 1.45, paragraphSpacing: 8, headingSizes: [24, 18, 15, 13, 12, 11],
    text: "1F2937", headingColor: "1E3A8A", accent: "2563EB", link: "2563EB",
    tableHeaderBg: "DBEAFE", tableHeaderText: "1E3A8A", tableBorder: "BFDBFE", codeBg: "F3F4F6",
  },
  {
    id: "formal", name: "Formal", description: "Times New Roman, black headings",
    font: "Times New Roman", cssFont: "'Times New Roman', Times, serif", headingFont: "Times New Roman",
    baseSize: 12, lineHeight: 1.5, paragraphSpacing: 10, headingSizes: [20, 16, 14, 13, 12, 12],
    text: "000000", headingColor: "000000", accent: "7F1D1D", link: "1D4ED8",
    tableHeaderBg: "E5E7EB", tableHeaderText: "000000", tableBorder: "9CA3AF", codeBg: "F3F4F6",
  },
  {
    id: "modern", name: "Modern", description: "Arial, teal accents",
    font: "Arial", cssFont: "Arial, Helvetica, sans-serif", headingFont: "Arial",
    baseSize: 10.5, lineHeight: 1.5, paragraphSpacing: 8, headingSizes: [26, 18, 14, 12, 11, 10.5],
    text: "334155", headingColor: "0F172A", accent: "0D9488", link: "0D9488",
    tableHeaderBg: "CCFBF1", tableHeaderText: "115E59", tableBorder: "99F6E4", codeBg: "F1F5F9",
  },
  {
    id: "academic", name: "Academic", description: "Double-spaced serif for papers",
    font: "Times New Roman", cssFont: "'Times New Roman', Times, serif", headingFont: "Times New Roman",
    baseSize: 12, lineHeight: 2, paragraphSpacing: 0, headingSizes: [16, 14, 12, 12, 12, 12],
    text: "000000", headingColor: "000000", accent: "000000", link: "000000",
    tableHeaderBg: "FFFFFF", tableHeaderText: "000000", tableBorder: "000000", codeBg: "F3F4F6",
  },
  {
    id: "compact", name: "Compact", description: "Small and tight — fits more per page",
    font: "Calibri", cssFont: "Calibri, Carlito, Arial, sans-serif", headingFont: "Calibri",
    baseSize: 10, lineHeight: 1.2, paragraphSpacing: 4, headingSizes: [18, 14, 12, 11, 10, 10],
    text: "111827", headingColor: "111827", accent: "4B5563", link: "2563EB",
    tableHeaderBg: "E5E7EB", tableHeaderText: "111827", tableBorder: "D1D5DB", codeBg: "F3F4F6",
  },
  {
    id: "report", name: "Report", description: "Cambria headings with a burgundy accent",
    font: "Cambria", cssFont: "Cambria, Caladea, Georgia, serif", headingFont: "Cambria",
    baseSize: 11, lineHeight: 1.5, paragraphSpacing: 9, headingSizes: [26, 19, 15, 13, 12, 11],
    text: "27272A", headingColor: "7F1D1D", accent: "991B1B", link: "991B1B",
    tableHeaderBg: "FEE2E2", tableHeaderText: "7F1D1D", tableBorder: "FECACA", codeBg: "F5F5F4",
  },
];

export function getDocTheme(id: string): DocTheme {
  return DOC_THEMES.find((t) => t.id === id) ?? DOC_THEMES[0];
}

/**
 * CSS for rendering model HTML with this theme, scoped under `.scope`. Sizes are in points so the
 * preview matches Word's metrics at the page's real size.
 */
export function themeCss(theme: DocTheme, scope: string, fontSizePt?: number): string {
  const base = fontSizePt ?? theme.baseSize;
  const k = base / theme.baseSize;
  const h = theme.headingSizes.map((s) => +(s * k).toFixed(2));
  return `
.${scope}{font-family:${theme.cssFont};font-size:${base}pt;line-height:${theme.lineHeight};color:#${theme.text};word-wrap:break-word}
.${scope} p{margin:0 0 ${theme.paragraphSpacing}pt}
.${scope} h1,.${scope} h2,.${scope} h3,.${scope} h4,.${scope} h5,.${scope} h6{font-family:${theme.headingFont},${theme.cssFont};color:#${theme.headingColor};line-height:1.2;margin:${theme.paragraphSpacing * 1.4}pt 0 ${theme.paragraphSpacing * 0.6}pt;font-weight:700}
.${scope} h1{font-size:${h[0]}pt;border-bottom:2pt solid #${theme.accent};padding-bottom:3pt}
.${scope} h2{font-size:${h[1]}pt}.${scope} h3{font-size:${h[2]}pt}.${scope} h4{font-size:${h[3]}pt}.${scope} h5{font-size:${h[4]}pt}.${scope} h6{font-size:${h[5]}pt}
.${scope} a{color:#${theme.link};text-decoration:underline}
.${scope} ul,.${scope} ol{margin:0 0 ${theme.paragraphSpacing}pt;padding-left:1.4em}
.${scope} li{margin:0 0 ${Math.max(2, theme.paragraphSpacing / 3)}pt}
.${scope} blockquote{margin:0 0 ${theme.paragraphSpacing}pt;padding:2pt 0 2pt 10pt;border-left:3pt solid #${theme.accent};font-style:italic}
.${scope} pre{margin:0 0 ${theme.paragraphSpacing}pt;padding:6pt 8pt;background:#${theme.codeBg};font-family:'Courier New',monospace;font-size:${(base * 0.9).toFixed(2)}pt;line-height:1.35;white-space:pre-wrap}
.${scope} code{font-family:'Courier New',monospace;background:#${theme.codeBg};padding:0 2pt}
.${scope} pre code{background:none;padding:0}
.${scope} hr{border:0;border-top:1pt solid #${theme.tableBorder};margin:${theme.paragraphSpacing}pt 0}
.${scope} table{border-collapse:collapse;width:100%;margin:0 0 ${theme.paragraphSpacing}pt}
.${scope} th,.${scope} td{border:1pt solid #${theme.tableBorder};padding:3pt 5pt;text-align:left;vertical-align:top}
.${scope} th{background:#${theme.tableHeaderBg};color:#${theme.tableHeaderText};font-weight:700}
`;
}
