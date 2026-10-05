import { marked, type Token, type Tokens } from "marked";

/** A run of inline text with optional emphasis. */
export interface Inline {
  text: string;
  bold?: boolean;
  italic?: boolean;
  code?: boolean;
  href?: string;
}

export interface ListItem {
  runs: Inline[];
  /** Nesting depth, 0–2. */
  level: number;
}

export type Block =
  | { type: "heading"; level: 1 | 2 | 3 | 4 | 5 | 6; runs: Inline[] }
  | { type: "paragraph"; runs: Inline[] }
  | { type: "list"; ordered: boolean; items: ListItem[] }
  | { type: "table"; header: Inline[][] | null; rows: Inline[][][] }
  | { type: "quote"; runs: Inline[] }
  | { type: "code"; text: string }
  | { type: "image"; src: string; alt: string }
  | { type: "rule" };

// ---------------------------------------------------------------------------------------------
// Markdown
// ---------------------------------------------------------------------------------------------

type Style = Pick<Inline, "bold" | "italic" | "href">;

function inlineFromTokens(tokens: Token[] | undefined, style: Style = {}): Inline[] {
  const runs: Inline[] = [];
  for (const token of tokens ?? []) {
    switch (token.type) {
      case "strong":
        runs.push(...inlineFromTokens((token as Tokens.Strong).tokens, { ...style, bold: true }));
        break;
      case "em":
        runs.push(...inlineFromTokens((token as Tokens.Em).tokens, { ...style, italic: true }));
        break;
      case "del":
        runs.push(...inlineFromTokens((token as Tokens.Del).tokens, style));
        break;
      case "link": {
        const link = token as Tokens.Link;
        runs.push(...inlineFromTokens(link.tokens, { ...style, href: link.href }));
        break;
      }
      case "image":
        runs.push({ text: (token as Tokens.Image).text, ...style });
        break;
      case "codespan":
        runs.push({ text: (token as Tokens.Codespan).text, code: true, ...style });
        break;
      case "br":
        runs.push({ text: "\n", ...style });
        break;
      case "text": {
        const text = token as Tokens.Text;
        if (text.tokens && text.tokens.length > 0) runs.push(...inlineFromTokens(text.tokens, style));
        else runs.push({ text: unescapeEntities(text.text), ...style });
        break;
      }
      case "escape":
        runs.push({ text: (token as Tokens.Escape).text, ...style });
        break;
      default: {
        const raw = (token as { raw?: string }).raw;
        if (raw) runs.push({ text: raw, ...style });
      }
    }
  }
  return runs;
}

function unescapeEntities(text: string): string {
  return text.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

function listItemsFromToken(list: Tokens.List, level: number, out: ListItem[]): void {
  for (const item of list.items) {
    const own: Token[] = [];
    const nested: Tokens.List[] = [];
    for (const child of item.tokens) {
      if (child.type === "list") nested.push(child as Tokens.List);
      else own.push(child);
    }
    const runs: Inline[] = [];
    for (const child of own) {
      if (child.type === "text" || child.type === "paragraph") {
        const sub = child as Tokens.Text;
        runs.push(...(sub.tokens ? inlineFromTokens(sub.tokens) : [{ text: sub.text }]));
      }
    }
    out.push({ runs, level: Math.min(level, 2) });
    for (const sub of nested) listItemsFromToken(sub, level + 1, out);
  }
}

export function parseMarkdown(markdown: string): Block[] {
  const blocks: Block[] = [];
  for (const token of marked.lexer(markdown)) {
    switch (token.type) {
      case "heading": {
        const heading = token as Tokens.Heading;
        blocks.push({ type: "heading", level: Math.min(6, Math.max(1, heading.depth)) as 1 | 2 | 3 | 4 | 5 | 6, runs: inlineFromTokens(heading.tokens) });
        break;
      }
      case "paragraph":
        blocks.push({ type: "paragraph", runs: inlineFromTokens((token as Tokens.Paragraph).tokens) });
        break;
      case "list": {
        const list = token as Tokens.List;
        const items: ListItem[] = [];
        listItemsFromToken(list, 0, items);
        blocks.push({ type: "list", ordered: list.ordered, items });
        break;
      }
      case "table": {
        const table = token as Tokens.Table;
        blocks.push({
          type: "table",
          header: table.header.map((cell) => inlineFromTokens(cell.tokens)),
          rows: table.rows.map((row) => row.map((cell) => inlineFromTokens(cell.tokens))),
        });
        break;
      }
      case "blockquote": {
        const quote = token as Tokens.Blockquote;
        const runs: Inline[] = [];
        for (const child of quote.tokens) {
          if (child.type === "paragraph") {
            if (runs.length > 0) runs.push({ text: "\n" });
            runs.push(...inlineFromTokens((child as Tokens.Paragraph).tokens));
          }
        }
        blocks.push({ type: "quote", runs });
        break;
      }
      case "code":
        blocks.push({ type: "code", text: (token as Tokens.Code).text });
        break;
      case "hr":
        blocks.push({ type: "rule" });
        break;
      case "html": {
        // Raw HTML in Markdown: keep its visible text rather than dropping it silently.
        const text = (token as Tokens.HTML).text.replace(/<[^>]*>/g, "").trim();
        if (text) blocks.push({ type: "paragraph", runs: [{ text }] });
        break;
      }
      default:
        break;
    }
  }
  return blocks;
}

// ---------------------------------------------------------------------------------------------
// Plain text
// ---------------------------------------------------------------------------------------------

/** Blank lines separate paragraphs; single line breaks inside a paragraph are kept. */
export function parsePlainText(text: string): Block[] {
  return text
    .split(/\r?\n\s*\r?\n/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .map((part) => ({ type: "paragraph" as const, runs: [{ text: part.replace(/\r?\n/g, "\n") }] }));
}

// ---------------------------------------------------------------------------------------------
// HTML (browser DOM)
// ---------------------------------------------------------------------------------------------

function inlineFromNode(node: Node, style: Style, out: Inline[]): void {
  if (node.nodeType === 3) {
    const text = (node.textContent ?? "").replace(/\s+/g, " ");
    if (text) out.push({ text, ...style });
    return;
  }
  if (node.nodeType !== 1) return;
  const el = node as Element;
  const tag = el.tagName.toLowerCase();
  if (tag === "script" || tag === "style") return;
  if (tag === "br") {
    out.push({ text: "\n", ...style });
    return;
  }
  const next: Style = { ...style };
  if (tag === "strong" || tag === "b") next.bold = true;
  if (tag === "em" || tag === "i") next.italic = true;
  if (tag === "a" && el.getAttribute("href")) next.href = el.getAttribute("href") ?? undefined;
  if (tag === "code") {
    const text = el.textContent ?? "";
    if (text) out.push({ text, code: true, ...style });
    return;
  }
  el.childNodes.forEach((child) => inlineFromNode(child, next, out));
}

function runsOf(el: Element): Inline[] {
  const out: Inline[] = [];
  el.childNodes.forEach((child) => inlineFromNode(child, {}, out));
  // Trim the outer whitespace left by indentation in the source markup.
  if (out.length > 0) out[0] = { ...out[0], text: out[0].text.replace(/^\s+/, "") };
  if (out.length > 0) out[out.length - 1] = { ...out[out.length - 1], text: out[out.length - 1].text.replace(/\s+$/, "") };
  return out.filter((run) => run.text.length > 0);
}

const SAFE_IMAGE = /^data:image\/(png|jpe?g|gif|webp);base64,/i;

function imageBlock(el: Element): Block | null {
  const src = el.getAttribute("src") ?? "";
  return SAFE_IMAGE.test(src) ? { type: "image", src, alt: el.getAttribute("alt") ?? "" } : null;
}

function listFromElement(el: Element, level: number, out: ListItem[]): void {
  for (const child of Array.from(el.children)) {
    if (child.tagName.toLowerCase() !== "li") continue;
    const shell = child.cloneNode(true) as Element;
    const nested: Element[] = [];
    shell.querySelectorAll(":scope > ul, :scope > ol").forEach((n) => {
      nested.push(n);
      n.remove();
    });
    out.push({ runs: runsOf(shell), level: Math.min(level, 2) });
    for (const sub of nested) listFromElement(sub, level + 1, out);
  }
}

function cellsOf(row: Element): Inline[][] {
  return Array.from(row.children)
    .filter((c) => /^(td|th)$/i.test(c.tagName))
    .map((c) => runsOf(c));
}

function blocksFromElement(parent: Element, out: Block[]): void {
  for (const child of Array.from(parent.children)) {
    const tag = child.tagName.toLowerCase();
    if (/^h[1-6]$/.test(tag)) {
      out.push({ type: "heading", level: Number(tag[1]) as 1 | 2 | 3 | 4 | 5 | 6, runs: runsOf(child) });
    } else if (tag === "img") {
      const image = imageBlock(child);
      if (image) out.push(image);
    } else if (tag === "p") {
      const runs = runsOf(child);
      if (runs.length > 0) out.push({ type: "paragraph", runs });
      child.querySelectorAll("img").forEach((img) => {
        const image = imageBlock(img);
        if (image) out.push(image);
      });
    } else if (tag === "ul" || tag === "ol") {
      const items: ListItem[] = [];
      listFromElement(child, 0, items);
      out.push({ type: "list", ordered: tag === "ol", items });
    } else if (tag === "table") {
      const rows = Array.from(child.querySelectorAll("tr"));
      const hasHead = child.querySelector("thead") !== null || (rows[0] && rows[0].querySelector("th") !== null);
      const parsed = rows.map(cellsOf).filter((r) => r.length > 0);
      if (parsed.length > 0) {
        out.push(hasHead ? { type: "table", header: parsed[0], rows: parsed.slice(1) } : { type: "table", header: null, rows: parsed });
      }
    } else if (tag === "blockquote") {
      const runs = runsOf(child);
      if (runs.length > 0) out.push({ type: "quote", runs });
    } else if (tag === "pre") {
      out.push({ type: "code", text: child.textContent ?? "" });
    } else if (tag === "hr") {
      out.push({ type: "rule" });
    } else if (tag === "script" || tag === "style") {
      continue;
    } else if (child.children.length > 0) {
      // Generic containers (div, section, article, body…): descend.
      blocksFromElement(child, out);
    } else {
      const runs = runsOf(child);
      if (runs.length > 0) out.push({ type: "paragraph", runs });
    }
  }
}

/** Needs a DOM (browser or jsdom). Headings, paragraphs, lists, tables, quotes, code and rules are kept. */
export function parseHtml(html: string): Block[] {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const blocks: Block[] = [];
  blocksFromElement(doc.body, blocks);
  // Loose text directly under <body> (no wrapping tags).
  if (blocks.length === 0) {
    const text = (doc.body.textContent ?? "").trim();
    if (text) blocks.push(...parsePlainText(text));
  }
  return blocks;
}

// ---------------------------------------------------------------------------------------------
// Rendering to safe HTML (live preview and PDF source)
// ---------------------------------------------------------------------------------------------

export function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function safeHref(href: string | undefined): string | null {
  if (!href) return null;
  return /^(https?:|mailto:)/i.test(href.trim()) ? href.trim() : null;
}

function runsToHtml(runs: Inline[]): string {
  return runs
    .map((run) => {
      let html = escapeHtml(run.text).replace(/\n/g, "<br>");
      if (run.code) html = `<code>${html}</code>`;
      if (run.bold) html = `<strong>${html}</strong>`;
      if (run.italic) html = `<em>${html}</em>`;
      const href = safeHref(run.href);
      if (href) html = `<a href="${escapeHtml(href)}">${html}</a>`;
      return html;
    })
    .join("");
}

/** Renders blocks to HTML. All text is escaped and only http(s)/mailto links are kept, so the output is safe to inject. */
export function blocksToHtml(blocks: Block[]): string {
  return blocks
    .map((block) => {
      switch (block.type) {
        case "heading":
          return `<h${block.level}>${runsToHtml(block.runs)}</h${block.level}>`;
        case "paragraph":
          return `<p>${runsToHtml(block.runs)}</p>`;
        case "quote":
          return `<blockquote>${runsToHtml(block.runs)}</blockquote>`;
        case "code":
          return `<pre><code>${escapeHtml(block.text)}</code></pre>`;
        case "rule":
          return "<hr>";
        case "image":
          return `<p><img src="${escapeHtml(block.src)}" alt="${escapeHtml(block.alt)}" style="max-width:100%;height:auto"></p>`;
        case "list": {
          const tag = block.ordered ? "ol" : "ul";
          return `<${tag}>${block.items
            .map((item) => `<li style="margin-left:${item.level * 1.4}em">${runsToHtml(item.runs)}</li>`)
            .join("")}</${tag}>`;
        }
        case "table": {
          const head = block.header
            ? `<thead><tr>${block.header.map((cell) => `<th>${runsToHtml(cell)}</th>`).join("")}</tr></thead>`
            : "";
          const body = `<tbody>${block.rows
            .map((row) => `<tr>${row.map((cell) => `<td>${runsToHtml(cell)}</td>`).join("")}</tr>`)
            .join("")}</tbody>`;
          return `<table>${head}${body}</table>`;
        }
      }
    })
    .join("\n");
}

export function runsToText(runs: Inline[]): string {
  return runs.map((r) => r.text).join("");
}

// ---------------------------------------------------------------------------------------------
// Markdown output
// ---------------------------------------------------------------------------------------------

function escapeMarkdown(text: string): string {
  return text
    .replace(/([\\`*[\]])/g, "\\$1")
    .replace(/(^|\s)_/g, "$1\\_")
    .replace(/_(\s|$)/g, "\\_$1");
}

function runsToMarkdown(runs: Inline[]): string {
  return runs
    .map((run) => {
      if (run.code) return "`" + run.text.replace(/`/g, "'") + "`";
      const lines = run.text.split("\n").map(escapeMarkdown);
      let text = lines.join("  \n");
      const lead = /^\s*/.exec(text)?.[0] ?? "";
      const trail = /\s*$/.exec(text)?.[0] ?? "";
      let core = text.slice(lead.length, text.length - trail.length);
      if (core && run.bold && run.italic) core = `***${core}***`;
      else if (core && run.bold) core = `**${core}**`;
      else if (core && run.italic) core = `*${core}*`;
      const href = safeHref(run.href);
      if (core && href) core = `[${core}](${href})`;
      text = lead + core + trail;
      return text;
    })
    .join("");
}

function startOfLineGuard(text: string): string {
  return text.replace(/^(\s*)(#{1,6}\s|>|[-+]\s|\d+[.)]\s)/, "$1\\$2");
}

/** Serializes blocks to Markdown (GitHub-flavoured tables, nested lists, fenced code, data-URL images). */
export function blocksToMarkdown(blocks: Block[]): string {
  const out: string[] = [];
  for (const block of blocks) {
    switch (block.type) {
      case "heading":
        out.push(`${"#".repeat(block.level)} ${runsToMarkdown(block.runs).replace(/\n/g, " ")}`);
        break;
      case "paragraph":
        out.push(startOfLineGuard(runsToMarkdown(block.runs)));
        break;
      case "quote":
        out.push(runsToMarkdown(block.runs).split("\n").map((l) => `> ${l}`).join("\n"));
        break;
      case "code":
        out.push("```\n" + block.text + "\n```");
        break;
      case "rule":
        out.push("---");
        break;
      case "image":
        out.push(`![${block.alt.replace(/[[\]]/g, "")}](${block.src})`);
        break;
      case "list": {
        const counters: number[] = [];
        out.push(
          block.items
            .map((item) => {
              counters.length = item.level + 1;
              counters[item.level] = (counters[item.level] ?? 0) + 1;
              const marker = block.ordered ? `${counters[item.level]}.` : "-";
              return `${"  ".repeat(item.level)}${marker} ${runsToMarkdown(item.runs).replace(/\n/g, " ")}`;
            })
            .join("\n")
        );
        break;
      }
      case "table": {
        const cell = (runs: Inline[]) => runsToMarkdown(runs).replace(/\|/g, "\\|").replace(/\n/g, " ");
        const header = block.header ?? block.rows[0] ?? [];
        const body = block.header ? block.rows : block.rows.slice(1);
        const width = Math.max(header.length, ...body.map((r) => r.length));
        const pad = (row: Inline[][]) => Array.from({ length: width }, (_, i) => cell(row[i] ?? []));
        out.push([`| ${pad(header).join(" | ")} |`, `| ${Array(width).fill("---").join(" | ")} |`, ...body.map((r) => `| ${pad(r).join(" | ")} |`)].join("\n"));
        break;
      }
    }
  }
  return out.join("\n\n") + (out.length ? "\n" : "");
}
