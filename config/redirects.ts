/**
 * Tools that were merged into a more capable one. Old URLs redirect permanently (308) to the new slug,
 * keeping inbound links and search rankings. Only slugs that no longer exist belong here.
 */
export const MERGED_TOOL_REDIRECTS: Record<string, string> = {
  "markdown-to-docx": "word-maker",
  "text-to-docx": "word-maker",
  "html-to-docx": "word-maker",
  "docx-to-html": "word-converter",
  "docx-to-text": "word-converter",
  "docx-to-pdf": "pdf-maker",
  "xlsx-to-pdf": "pdf-maker",
  "text-to-pdf": "pdf-maker",
  "html-to-pdf": "pdf-maker",
  "csv-to-xlsx": "spreadsheet-converter",
  "xlsx-to-csv": "spreadsheet-converter",
  "xlsx-to-json": "spreadsheet-converter",
  "json-to-xlsx": "spreadsheet-converter",
  "xlsx-to-html-table": "spreadsheet-converter",
  "xlsx-viewer": "spreadsheet-studio",
  "xlsx-merge": "spreadsheet-studio",
  "xlsx-split": "spreadsheet-studio",
  "xlsx-duplicate-remover": "spreadsheet-studio",
  "xlsx-column-remover": "spreadsheet-studio",
  "markdown-to-pptx": "powerpoint-maker",
  "text-to-pptx": "powerpoint-maker",
};
