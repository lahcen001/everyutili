import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { IntlMessageFormat } from "intl-messageformat";
import { describe, expect, it } from "vitest";

const dir = path.join(process.cwd(), "messages");
const sample: Record<string, Record<string, string | number>> = {
  todosOverdue: { count: 3 },
  todosToday: { count: 1 },
  habitsLeft: { count: 5 },
  examSoon: { name: "Chem", days: 0 },
  cardsDue: { count: 12 },
  timerRunning: { subject: "Maths" },
};

describe("reminder messages", () => {
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
    const locale = file.replace(".json", "");
    it(`${locale}: every reminder string parses and formats`, () => {
      const ns = JSON.parse(readFileSync(path.join(dir, file), "utf-8")).reminders as Record<string, string>;
      for (const [key, values] of Object.entries(sample)) {
        const out = new IntlMessageFormat(ns[key], locale).format(values) as string;
        expect(out, `${locale}.${key}`).toBeTruthy();
        expect(out).not.toMatch(/[{}]/);
        if ("name" in values) expect(out).toContain(String(values.name));
      }
      expect(ns.notificationTitle).toContain("EveryUtili");
    });
  }
});
