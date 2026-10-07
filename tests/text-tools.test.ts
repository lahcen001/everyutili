import { describe, expect, it } from "vitest";
import { applyCase, splitWords } from "@/lib/textCase";
import { toTitleCase } from "@/lib/titleCase";
import { DEFAULT_SLUG, slugify } from "@/lib/slug";

describe("splitWords", () => {
  it("splits camelCase, acronyms, digits and separators", () => {
    expect(splitWords("getHTTPResponse")).toEqual(["get", "HTTP", "Response"]);
    expect(splitWords("hello_world-foo.bar baz")).toEqual(["hello", "world", "foo", "bar", "baz"]);
    expect(splitWords("version2Update")).toEqual(["version2", "Update"]);
    expect(splitWords("naïve café")).toEqual(["naïve", "café"]);
  });
});

describe("applyCase", () => {
  it("converts identifiers per line", () => {
    expect(applyCase("getHTTPResponse", "snake")).toBe("get_http_response");
    expect(applyCase("hello world\nfoo bar", "camel")).toBe("helloWorld\nfooBar");
    expect(applyCase("hello world", "constant")).toBe("HELLO_WORLD");
    expect(applyCase("Hello World", "kebab")).toBe("hello-world");
    expect(applyCase("hello world", "train")).toBe("Hello-World");
    expect(applyCase("hello world", "pascal")).toBe("HelloWorld");
    expect(applyCase("hello world", "dot")).toBe("hello.world");
  });
  it("capitalizes words, including accented and apostrophes", () => {
    expect(applyCase("élan vital isn't DEAD", "capitalized")).toBe("Élan Vital Isn't Dead");
    expect(applyCase("straße", "upper")).toBe("STRASSE");
  });
  it("sentence case handles several sentences and lowercases the rest", () => {
    expect(applyCase("HELLO there. how ARE you? fine!", "sentence")).toBe("Hello there. How are you? Fine!");
  });
  it("alternating and inverse", () => {
    expect(applyCase("hello world", "alternating")).toBe("hElLo WoRlD");
    expect(applyCase("Hello", "inverse")).toBe("hELLO");
  });
});

describe("toTitleCase", () => {
  const ap = { style: "ap" as const, preserveCaps: true };
  it("lowercases minor words but not first, last or after a colon", () => {
    expect(toTitleCase("the art of war: a guide to winning", ap)).toBe("The Art of War: A Guide to Winning");
    expect(toTitleCase("what are you up to", ap)).toBe("What Are You up To");
  });
  it("styles differ on longer prepositions", () => {
    expect(toTitleCase("a walk through the park", { style: "ap", preserveCaps: true })).toBe("A Walk Through the Park");
    expect(toTitleCase("a walk through the park", { style: "chicago", preserveCaps: true })).toBe("A Walk through the Park");
    expect(toTitleCase("a walk with the dog", { style: "apa", preserveCaps: true })).toBe("A Walk With the Dog");
  });
  it("keeps acronyms and mixed-case brands, capitalizes hyphen parts", () => {
    expect(toTitleCase("NASA and the iPhone: a well-known story", ap)).toBe("NASA and the iPhone: A Well-Known Story");
    expect(toTitleCase("nasa launch", { style: "ap", preserveCaps: false })).toBe("Nasa Launch");
  });
  it("works line by line and every-word style", () => {
    expect(toTitleCase("one of two\nand then", ap)).toBe("One of Two\nAnd Then");
    expect(toTitleCase("a tale of two cities", { style: "every", preserveCaps: false })).toBe("A Tale Of Two Cities");
  });
});

describe("slugify", () => {
  it("makes clean ASCII slugs", () => {
    expect(slugify("  Hello, World! It's 2024 & beyond  ", DEFAULT_SLUG)).toBe("hello-world-its-2024-and-beyond");
  });
  it("transliterates accents, ligatures, Cyrillic, Greek and Arabic", () => {
    expect(slugify("Crème brûlée Straße Ærø", DEFAULT_SLUG)).toBe("creme-brulee-strasse-aero");
    expect(slugify("Привет мир", DEFAULT_SLUG)).toBe("privet-mir");
    expect(slugify("Ελληνικά", DEFAULT_SLUG)).toBe("ellinika");
    expect(slugify("مرحبا", DEFAULT_SLUG)).toBe("mrhba");
  });
  it("keeps unicode letters when asked", () => {
    expect(slugify("日本語 テスト", { ...DEFAULT_SLUG, transliterate: false, keepUnicode: true })).toBe("日本語-テスト");
    expect(slugify("日本語", DEFAULT_SLUG)).toBe("");
  });
  it("supports separators, case, stop words and max length at a word boundary", () => {
    expect(slugify("The Quick Brown Fox", { ...DEFAULT_SLUG, separator: "_", lowercase: false })).toBe("The_Quick_Brown_Fox");
    expect(slugify("the art of the deal", { ...DEFAULT_SLUG, removeStopWords: true })).toBe("art-deal");
    expect(slugify("one two three four", { ...DEFAULT_SLUG, maxLength: 11 })).toBe("one-two");
    expect(slugify("one two three four", { ...DEFAULT_SLUG, maxLength: 13 })).toBe("one-two-three");
  });
});
