export interface RegexPreset {
  id: string;
  name: string;
  pattern: string;
  flags: string;
  sample: string;
}

export const REGEX_PRESETS: RegexPreset[] = [
  { id: "email", name: "Email address", pattern: "[\\w.+-]+@[\\w-]+(?:\\.[\\w-]+)+", flags: "gi", sample: "Contact ada@example.com or grace.hopper+news@mail.navy.mil today." },
  { id: "url", name: "URL", pattern: "https?:\\/\\/[^\\s/$.?#].[^\\s]*", flags: "gi", sample: "Docs: https://example.com/a?b=1 and http://localhost:3000/path#top." },
  { id: "ipv4", name: "IPv4 address", pattern: "\\b(?:(?:25[0-5]|2[0-4]\\d|1?\\d?\\d)\\.){3}(?:25[0-5]|2[0-4]\\d|1?\\d?\\d)\\b", flags: "g", sample: "Hosts: 192.168.1.10, 10.0.0.255 and 999.1.1.1 (invalid)." },
  { id: "hex", name: "Hex colour", pattern: "#(?:[0-9a-fA-F]{3}){1,2}\\b", flags: "g", sample: "Colours: #fff, #1a2B3c, #12 and #abcdef." },
  { id: "date", name: "ISO date (YYYY-MM-DD)", pattern: "(?<year>\\d{4})-(?<month>0[1-9]|1[0-2])-(?<day>0[1-9]|[12]\\d|3[01])", flags: "g", sample: "Released 2024-03-15, patched 2024-12-01, typo 2024-13-40." },
  { id: "time", name: "Time (24h)", pattern: "\\b(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d)?\\b", flags: "g", sample: "Meet at 09:30, lunch 12:15:45, not 25:61." },
  { id: "phone", name: "Phone number", pattern: "\\+?\\d{1,3}[\\s.-]?\\(?\\d{3}\\)?[\\s.-]?\\d{3}[\\s.-]?\\d{4}", flags: "g", sample: "Call +1 (555) 010-9999 or 555.010.1234." },
  { id: "hashtag", name: "Hashtag / mention", pattern: "[#@][\\p{L}\\d_]+", flags: "gu", sample: "Thanks @ada for the #regex tips and #café ideas!" },
  { id: "uuid", name: "UUID", pattern: "\\b[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\\b", flags: "gi", sample: "id=123e4567-e89b-12d3-a456-426614174000 and 00000000-0000-0000-0000-000000000000" },
  { id: "html-tag", name: "HTML tag", pattern: "<\\/?([a-z][a-z0-9-]*)\\b[^>]*>", flags: "gi", sample: '<div class="a"><p>Hello <b>world</b></p><br/></div>' },
  { id: "duplicate-words", name: "Repeated word", pattern: "\\b(\\w+)\\s+\\1\\b", flags: "gi", sample: "This is is a test of the the repeated words." },
  { id: "whitespace", name: "Trailing whitespace", pattern: "[ \\t]+$", flags: "gm", sample: "line one   \nline two\t\nline three" },
  { id: "number", name: "Number (int/decimal)", pattern: "-?\\d+(?:\\.\\d+)?(?:[eE][+-]?\\d+)?", flags: "g", sample: "Values: 42, -3.14, 6.02e23 and .5 (partial)." },
];

export const CHEAT_SHEET: { group: string; items: [string, string][] }[] = [
  {
    group: "Characters",
    items: [
      [".", "any character except newline"],
      ["\\d  \\D", "digit / not a digit"],
      ["\\w  \\W", "word character / not"],
      ["\\s  \\S", "whitespace / not"],
      ["[abc]  [^abc]", "any of / none of"],
      ["[a-z]", "a range"],
      ["\\p{L}", "a Unicode letter (needs the u flag)"],
    ],
  },
  {
    group: "Anchors",
    items: [
      ["^  $", "start / end of text (or line with m)"],
      ["\\b  \\B", "word boundary / not"],
    ],
  },
  {
    group: "Groups",
    items: [
      ["(abc)", "capture group"],
      ["(?:abc)", "non-capturing group"],
      ["(?<name>abc)", "named group"],
      ["\\1  \\k<name>", "back-reference"],
      ["a|b", "a or b"],
    ],
  },
  {
    group: "Quantifiers",
    items: [
      ["*  +  ?", "0+ / 1+ / 0 or 1"],
      ["{3}  {3,}  {3,5}", "exact / min / range"],
      ["*?  +?", "lazy (as few as possible)"],
    ],
  },
  {
    group: "Lookaround",
    items: [
      ["(?=x)  (?!x)", "followed by / not followed by"],
      ["(?<=x)  (?<!x)", "preceded by / not preceded by"],
    ],
  },
  {
    group: "Replacement",
    items: [
      ["$1  $<name>", "insert a captured group"],
      ["$&  $$", "whole match / a literal $"],
    ],
  },
];
