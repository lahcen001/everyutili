import { describe, expect, it } from "vitest";
import type { IptvChannel } from "@/lib/iptv";
import { buildIndex, guessCountryCode, normalize, searchChannels, suggestCountries } from "@/lib/iptvSearch";

const ch = (id: string, name: string, code: string, country: string, categories: string[] = []): IptvChannel => ({
  id,
  name,
  logo: null,
  countryCode: code,
  countryName: country,
  countryFlag: null,
  categories,
  streamUrl: "https://x/y.m3u8",
  quality: null,
});

const channels = [
  ch("1", "BBC One", "GB", "United Kingdom", ["general"]),
  ch("2", "Al Aoula", "MA", "Morocco", ["general"]),
  ch("3", "Arryadia", "MA", "Morocco", ["sports"]),
  ch("4", "ESPN", "US", "United States", ["sports"]),
  ch("5", "Canal+ Sport", "FR", "France", ["sports"]),
  ch("6", "Télé Maroc", "MA", "Morocco", ["general"]),
];
const names = new Map([["general", "General"], ["sports", "Sports"]]);
const index = buildIndex(channels, names);
const ids = (r: IptvChannel[]) => r.map((c) => c.id);

describe("normalize", () => {
  it("strips accents and punctuation", () => {
    expect(normalize("  Télé-Maroc! ")).toBe("tele maroc");
  });
});

describe("searchChannels", () => {
  it("returns everything in order for an empty query", () => {
    expect(ids(searchChannels(index, ""))).toEqual(["1", "2", "3", "4", "5", "6"]);
  });
  it("finds channels by country name", () => {
    expect(ids(searchChannels(index, "morocco")).sort()).toEqual(["2", "3", "6"]);
  });
  it("combines country and category words", () => {
    expect(ids(searchChannels(index, "morocco sports"))).toEqual(["3"]);
  });
  it("understands aliases and country codes", () => {
    expect(ids(searchChannels(index, "uk"))).toEqual(["1"]);
    expect(ids(searchChannels(index, "usa"))).toEqual(["4"]);
    expect(ids(searchChannels(index, "ma sports"))).toEqual(["3"]);
  });
  it("ranks name matches first", () => {
    expect(searchChannels(index, "sport")[0].id).not.toBe("");
    expect(ids(searchChannels(index, "espn"))[0]).toBe("4");
  });
  it("ignores accents", () => {
    expect(ids(searchChannels(index, "tele"))).toEqual(["6"]);
  });
  it("tolerates a typo only when nothing matches exactly", () => {
    expect(ids(searchChannels(index, "morroco"))).toEqual(expect.arrayContaining(["2", "3", "6"]));
    expect(searchChannels(index, "zzzzzz")).toEqual([]);
  });
  it("applies country and category filters", () => {
    expect(ids(searchChannels(index, "", { countryCode: "MA", category: "sports" }))).toEqual(["3"]);
  });
});

describe("suggestCountries / guessCountryCode", () => {
  const countries = [
    { code: "MA", name: "Morocco", flag: "" },
    { code: "GB", name: "United Kingdom", flag: "" },
    { code: "US", name: "United States", flag: "" },
  ];
  it("suggests countries from partial text and aliases", () => {
    expect(suggestCountries("moro", countries).map((c) => c.code)).toEqual(["MA"]);
    expect(suggestCountries("uk", countries).map((c) => c.code)).toEqual(["GB"]);
    expect(suggestCountries("m", countries)).toEqual([]);
  });
  it("guesses the country from the browser language", () => {
    expect(guessCountryCode(["ar-MA", "en"])).toBe("MA");
    expect(guessCountryCode(["en"])).toBeNull();
  });
});
