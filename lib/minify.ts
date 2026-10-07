import { minifyJsonAst, parseJsonAst, printJson } from "@/lib/json";

/* ----------------------------------------------------------------- CSS */

interface CssOptions {
  keepComments: boolean;
}

/**
 * Minify CSS. Strings and url() are copied untouched. Whitespace is only dropped where it can't
 * change meaning: around { } ; , > ~ and after ":" — never before ":" (so `a :hover` stays a
 * descendant selector) and never around + or - (calc() needs them).
 */
export function minifyCss(css: string, opts: CssOptions = { keepComments: false }): string {
  let out = "";
  let space = false;
  const emit = (token: string) => {
    if (space && out) {
      const prev = out[out.length - 1];
      const dropAfter = /[{};,>~:]/.test(prev) || out.endsWith("*/");
      const dropBefore = /^[{};,>~]/.test(token);
      if (!dropAfter && !dropBefore) out += " ";
    }
    space = false;
    out += token;
  };
  let i = 0;
  const n = css.length;
  while (i < n) {
    const c = css[i];
    if (c === "/" && css[i + 1] === "*") {
      const end = css.indexOf("*/", i + 2);
      const stop = end === -1 ? n : end + 2;
      if (opts.keepComments || css[i + 2] === "!") emit(css.slice(i, stop));
      else space = true;
      i = stop;
    } else if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < n && css[j] !== c) j += css[j] === "\\" ? 2 : 1;
      emit(css.slice(i, j + 1));
      i = j + 1;
    } else if (css.startsWith("url(", i) && !/^url\(\s*["']/.test(css.slice(i, i + 12))) {
      const end = css.indexOf(")", i);
      const stop = end === -1 ? n : end + 1;
      emit(css.slice(i, stop).replace(/\s+/g, ""));
      i = stop;
    } else if (/\s/.test(c)) {
      space = true;
      i++;
    } else {
      emit(c);
      i++;
    }
  }
  return out.replace(/;}/g, "}").trim();
}

export function beautifyCss(css: string, indent = "  "): string {
  const min = minifyCss(css, { keepComments: true });
  let out = "";
  let depth = 0;
  let i = 0;
  const n = min.length;
  const pad = () => indent.repeat(depth);
  while (i < n) {
    const c = min[i];
    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < n && min[j] !== c) j += min[j] === "\\" ? 2 : 1;
      out += min.slice(i, j + 1);
      i = j + 1;
    } else if (c === "/" && min[i + 1] === "*") {
      const end = min.indexOf("*/", i + 2);
      const stop = end === -1 ? n : end + 2;
      out += `${out.endsWith("\n") || out === "" ? "" : "\n"}${pad()}${min.slice(i, stop)}\n`;
      i = stop;
    } else if (min.startsWith("url(", i)) {
      const end = min.indexOf(")", i);
      const stop = end === -1 ? n : end + 1;
      out += min.slice(i, stop);
      i = stop;
    } else if (c === "{") {
      out = `${out.trimEnd()} {\n`;
      depth++;
      out += pad();
      i++;
    } else if (c === "}") {
      depth = Math.max(0, depth - 1);
      let body = out.trimEnd();
      if (!/[;{}]$/.test(body) && !body.endsWith("*/")) body += ";";
      out = `${body}\n${pad()}}\n${depth === 0 ? "\n" : ""}`;
      out += pad();
      i++;
    } else if (c === ";") {
      out += ";\n" + pad();
      i++;
    } else if (c === ":" && depth > 0 && min[i + 1] !== " ") {
      out += ": ";
      i++;
    } else if (c === ",") {
      out += depth === 0 ? ",\n" : ", ";
      i++;
    } else {
      out += c;
      i++;
    }
  }
  return out.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}

/* ---------------------------------------------------------------- HTML */

const BLOCK = new Set("html head body title meta link base style script noscript template div p ul ol li dl dt dd table caption colgroup col thead tbody tfoot tr td th h1 h2 h3 h4 h5 h6 section article header footer nav main aside form fieldset legend select option optgroup datalist blockquote figure figcaption details summary dialog hr br address pre textarea svg".split(" "));

const TOKEN = /<!--[\s\S]*?-->|<(script|style|pre|textarea)\b(?:"[^"]*"|'[^']*'|[^>"'])*>[\s\S]*?<\/\1\s*>|<!?\/?[a-zA-Z][^>"']*(?:(?:"[^"]*"|'[^']*')[^>"']*)*>|<![^>]*>|[^<]+|</g;

const tagName = (tag: string) => /^<\/?([a-zA-Z][a-zA-Z0-9-]*)/.exec(tag)?.[1]?.toLowerCase() ?? "";

function compactTag(tag: string): string {
  // collapse whitespace between attributes, but leave quoted values alone
  let out = "";
  let i = 0;
  while (i < tag.length) {
    const c = tag[i];
    if (c === '"' || c === "'") {
      const end = tag.indexOf(c, i + 1);
      const stop = end === -1 ? tag.length : end + 1;
      out += tag.slice(i, stop);
      i = stop;
    } else if (/\s/.test(c)) {
      while (i < tag.length && /\s/.test(tag[i])) i++;
      out += " ";
    } else {
      out += c;
      i++;
    }
  }
  return out.replace(/\s+(\/?>)$/, "$1").replace(/\s*=\s*(["'])/g, "=$1");
}

export interface HtmlOptions {
  keepComments: boolean;
}

export function minifyHtml(html: string, opts: HtmlOptions = { keepComments: false }): string {
  const tokens = html.match(TOKEN) ?? [];
  const parts: { text: string; block: boolean; isText: boolean }[] = [];
  for (const tok of tokens) {
    if (tok.startsWith("<!--")) {
      // keep IE conditional comments and, if asked, ordinary ones
      if (opts.keepComments || /^<!--\[if|<!\[endif\]-->$/.test(tok)) parts.push({ text: tok, block: true, isText: false });
      continue;
    }
    const raw = /^<(script|style|pre|textarea)\b/i.exec(tok);
    if (raw) {
      const name = raw[1].toLowerCase();
      const open = /^<[^>]*(?:(?:"[^"]*"|'[^']*')[^>]*)*>/.exec(tok)![0];
      const closeIdx = tok.toLowerCase().lastIndexOf(`</${name}`);
      const inner = tok.slice(open.length, closeIdx);
      const close = tok.slice(closeIdx);
      const body = name === "style" ? minifyCss(inner) : name === "script" ? inner.trim() : inner;
      parts.push({ text: compactTag(open) + body + close.replace(/\s+>$/, ">"), block: BLOCK.has(name) && name !== "pre" && name !== "textarea", isText: false });
    } else if (tok.startsWith("<") && tok.length > 1 && /^<[!/a-zA-Z]/.test(tok)) {
      parts.push({ text: tok.startsWith("<!") ? tok.trim() : compactTag(tok), block: BLOCK.has(tagName(tok)) || tok.startsWith("<!"), isText: false });
    } else {
      const last = parts[parts.length - 1];
      // a removed comment can leave two text tokens side by side; treat them as one
      if (last?.isText) last.text += tok;
      else parts.push({ text: tok, block: false, isText: true });
    }
  }
  let out = "";
  parts.forEach((p, idx) => {
    if (!p.isText) {
      out += p.text;
      return;
    }
    const collapsed = p.text.replace(/\s+/g, " ");
    const prev = parts[idx - 1];
    const next = parts[idx + 1];
    let text = collapsed;
    if (!prev || prev.block) text = text.replace(/^ /, "");
    if (!next || next.block) text = text.replace(/ $/, "");
    out += text;
  });
  return out.trim();
}

/** SVG: HTML rules plus the XML prolog, doctype, editor metadata and empty attributes dropped. */
export function minifySvg(svg: string): string {
  return minifyHtml(svg.replace(/<\?xml[\s\S]*?\?>/g, "").replace(/<!DOCTYPE[\s\S]*?>/gi, "").replace(/<metadata[\s\S]*?<\/metadata>/gi, "").replace(/\s(?:xml:space|inkscape:[a-z-]+|sodipodi:[a-z-]+)="[^"]*"/g, ""));
}

/* ---------------------------------------------------------- JS / JSON */

export async function minifyJs(code: string): Promise<{ ok: true; text: string } | { ok: false; message: string; line?: number; column?: number }> {
  try {
    const { minify } = await import("terser");
    const r = await minify(code, { compress: true, mangle: true, format: { comments: false } });
    return { ok: true, text: r.code ?? "" };
  } catch (e) {
    const err = e as { message?: string; line?: number; col?: number };
    return { ok: false, message: err.message ?? "Could not minify this JavaScript", line: err.line, column: err.col !== undefined ? err.col + 1 : undefined };
  }
}

export function minifyJson(json: string, beautify = false): { ok: true; text: string } | { ok: false; message: string; line: number; column: number } {
  const p = parseJsonAst(json);
  if (!p.ok) return { ok: false, message: p.error.message, line: p.error.line, column: p.error.column };
  return { ok: true, text: beautify ? printJson(p.ast, { indent: 2, sortKeys: false }) : minifyJsonAst(p.ast) };
}

/** Size of text after gzip, using the browser's CompressionStream. null when unsupported. */
export async function gzipSize(text: string): Promise<number | null> {
  if (typeof CompressionStream === "undefined") return null;
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream("gzip"));
  return (await new Response(stream).arrayBuffer()).byteLength;
}
