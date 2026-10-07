import { describe, expect, it } from "vitest";
import { beautifyCss, minifyCss, minifyHtml, minifyJs, minifyJson, minifySvg } from "@/lib/minify";

describe("minifyCss", () => {
  it("removes comments and whitespace", () => {
    expect(minifyCss("/* c */ body {\n  margin: 0 ;\n  padding : 0;\n}")).toBe("body{margin:0;padding :0}");
  });
  it("keeps descendant pseudo selectors (a :hover is not a:hover)", () => {
    expect(minifyCss("div :first-child { color: red }")).toBe("div :first-child{color:red}");
    expect(minifyCss("a:hover , b:focus { x: y }")).toBe("a:hover,b:focus{x:y}");
  });
  it("keeps calc() operators and strings intact", () => {
    expect(minifyCss('a { width: calc(100% - 10px + 2px); content: "  /*  " }')).toBe('a{width:calc(100% - 10px + 2px);content:"  /*  "}');
  });
  it("keeps /*! comments, url() contents and media queries", () => {
    expect(minifyCss("/*! license */ a{background:url( 'a b.png' )}")).toBe("/*! license */a{background:url( 'a b.png' )}");
    expect(minifyCss("@media screen and (min-width: 600px) { a { b: c } }")).toBe("@media screen and (min-width:600px){a{b:c}}");
  });
  it("handles child combinators", () => {
    expect(minifyCss("a > b ~ c { x: y }")).toBe("a>b~c{x:y}");
  });
  it("beautify round-trips structure", () => {
    const pretty = beautifyCss("a{b:c;d:e}@media (x){f{g:h}}");
    expect(pretty).toContain("a {\n  b: c;\n  d: e;\n}");
    expect(pretty).toContain("@media (x) {\n  f {");
    expect(minifyCss(pretty)).toBe("a{b:c;d:e}@media (x){f{g:h}}");
  });
});

describe("minifyHtml", () => {
  it("removes comments but keeps a space between inline elements", () => {
    expect(minifyHtml("<div>\n  <!-- hi -->\n  <b>a</b> <i>b</i>\n</div>")).toBe("<div><b>a</b> <i>b</i></div>");
  });
  it("keeps pre and textarea exactly", () => {
    expect(minifyHtml("<p>x</p>\n<pre>  a\n   b  </pre>")).toBe("<p>x</p><pre>  a\n   b  </pre>");
  });
  it("minifies style blocks and keeps comment-like text inside script/pre", () => {
    const out = minifyHtml("<style>\n a { b : c }\n</style><script>\n var s = '<!-- x -->';\n</script><pre><!-- keep --></pre>");
    expect(out).toContain("<style>a{b :c}</style>");
    expect(out).toContain("var s = '<!-- x -->';");
    expect(out).toContain("<pre><!-- keep --></pre>");
  });
  it("collapses attribute whitespace and keeps quoted values", () => {
    expect(minifyHtml('<a   href = "x  y"\n class="a">t</a>')).toBe('<a href="x  y" class="a">t</a>');
  });
  it("keeps conditional comments only", () => {
    expect(minifyHtml("<!--[if IE]><p>ie</p><![endif]--><p>x</p><!-- gone -->")).toContain("<!--[if IE]>");
    expect(minifyHtml("<p>x</p><!-- gone -->")).toBe("<p>x</p>");
  });
  it("keeps > inside attribute values", () => {
    expect(minifyHtml('<a title="a>b">x</a>')).toBe('<a title="a>b">x</a>');
  });
  it("keeps doctype", () => {
    expect(minifyHtml("<!DOCTYPE html>\n<html>\n<body>\n<p>x</p>\n</body>\n</html>")).toBe("<!DOCTYPE html><html><body><p>x</p></body></html>");
  });
});

describe("minifySvg / minifyJson / minifyJs", () => {
  it("drops the xml prolog, doctype and metadata", () => {
    const svg = minifySvg('<?xml version="1.0"?>\n<!DOCTYPE svg>\n<svg xmlns="http://www.w3.org/2000/svg">\n  <metadata>x</metadata>\n  <path d="M0 0"/>\n</svg>');
    expect(svg).toBe('<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0"/></svg>');
  });
  it("minifies and beautifies JSON, reporting errors with position", () => {
    expect(minifyJson('{ "a" : [ 1 , 2 ] }')).toEqual({ ok: true, text: '{"a":[1,2]}' });
    const b = minifyJson('{"a":1}', true);
    expect(b.ok && b.text).toBe('{\n  "a": 1\n}');
    const bad = minifyJson("{");
    expect(bad.ok).toBe(false);
  });
  it("minifies JavaScript with terser and reports syntax errors", async () => {
    const ok = await minifyJs("function add(first, second) {\n  // sum\n  return first + second;\n}\nconsole.log(add(1, 2));");
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.text.length).toBeLessThan(60);
    const bad = await minifyJs("function (");
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.line).toBe(1);
  });
});
