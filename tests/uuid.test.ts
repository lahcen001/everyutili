import { describe, expect, it } from "vitest";
import { formatUuid, generateUuid, inspectUuid, uuidV1, uuidV7 } from "@/lib/uuid";

describe("uuid", () => {
  it("v4 is valid with version 4", () => {
    const i = inspectUuid(generateUuid("v4"));
    expect(i.valid).toBe(true);
    expect(i.version).toBe(4);
    expect(i.variant).toContain("RFC");
  });
  it("v7 embeds the timestamp and sorts by time", () => {
    const t = 1_700_000_000_000;
    const a = uuidV7(t);
    const b = uuidV7(t + 5000);
    expect(inspectUuid(a).version).toBe(7);
    expect(inspectUuid(a).timestamp?.getTime()).toBe(t);
    expect(a < b).toBe(true);
  });
  it("v1 embeds the timestamp within a ms", () => {
    const t = 1_700_000_000_000;
    const i = inspectUuid(uuidV1(t));
    expect(i.version).toBe(1);
    expect(Math.abs((i.timestamp?.getTime() ?? 0) - t)).toBeLessThanOrEqual(1);
  });
  it("formats", () => {
    const id = "123e4567-e89b-12d3-a456-426614174000";
    expect(formatUuid(id, "nohyphens", false)).toBe("123e4567e89b12d3a456426614174000");
    expect(formatUuid(id, "braces", true)).toBe("{123E4567-E89B-12D3-A456-426614174000}");
    expect(formatUuid(id, "urn", false)).toBe(`urn:uuid:${id}`);
    expect(formatUuid(id, "base64", false)).toHaveLength(22);
  });
  it("validates and normalizes", () => {
    expect(inspectUuid("not-a-uuid").valid).toBe(false);
    expect(inspectUuid("{123E4567-E89B-12D3-A456-426614174000}").normalized).toBe("123e4567-e89b-12d3-a456-426614174000");
    expect(inspectUuid("00000000-0000-0000-0000-000000000000").nil).toBe(true);
  });
});
