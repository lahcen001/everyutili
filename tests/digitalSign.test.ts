// @vitest-environment node
import { describe, expect, it } from "vitest";
import forge from "node-forge";
import { PDFDocument } from "pdf-lib";
import { createSelfSignedP12, readIdentity, signPdfDigitally } from "@/lib/pdf/digitalSign";

const bin = (b: Uint8Array) => Buffer.from(b).toString("latin1");

async function samplePdf() {
  const doc = await PDFDocument.create();
  doc.addPage([300, 400]).drawText("Contract");
  doc.addPage([300, 400]);
  return doc.save();
}

describe("digital PDF signature", () => {
  it("embeds a verifiable detached PKCS#7 signature", async () => {
    const { p12 } = await createSelfSignedP12({ name: "Ada Lovelace", email: "ada@example.com", password: "pw" });
    expect(readIdentity(p12, "pw").cert.subject.getField("CN").value).toBe("Ada Lovelace");
    expect(() => readIdentity(p12, "nope")).toThrow(/password/i);

    const signed = await signPdfDigitally(await samplePdf(), { p12, password: "pw", reason: "I approve", visible: "bottom-right", now: new Date("2026-01-02T03:04:05Z") });
    const text = bin(signed);
    const m = text.match(/\/ByteRange \[0 (\d+)\s+(\d+)\s+(\d+)\s*\]/)!;
    const [a, b, c] = [Number(m[1]), Number(m[2]), Number(m[3])];
    expect(b + c).toBe(signed.length);
    const hex = text.slice(a + 1, b - 1);
    const der = forge.util.hexToBytes(hex.replace(/(00)+$/, ""));
    const content = text.slice(0, a) + text.slice(b);

    const p7 = forge.pkcs7.messageFromAsn1(forge.asn1.fromDer(der)) as forge.pkcs7.PkcsSignedData & { rawCapture: Record<string, unknown> };
    const attrs = p7.rawCapture.authenticatedAttributes as forge.asn1.Asn1[];
    const digestAttr = attrs.find((x) => forge.asn1.derToOid((x.value[0] as forge.asn1.Asn1).value as string) === forge.pki.oids.messageDigest)!;
    const digest = ((digestAttr.value[1] as forge.asn1.Asn1).value[0] as forge.asn1.Asn1).value as string;
    expect(digest).toBe(forge.md.sha256.create().update(content).digest().getBytes());

    const set = forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SET, true, attrs);
    const md = forge.md.sha256.create().update(forge.asn1.toDer(set).getBytes());
    const cert = p7.certificates[0];
    expect((cert.publicKey as forge.pki.rsa.PublicKey).verify(md.digest().getBytes(), p7.rawCapture.signature as string)).toBe(true);

    // the file is still a readable PDF with a signature field
    const reopened = await PDFDocument.load(signed);
    expect(reopened.getPageCount()).toBe(2);
    expect(text).toContain("/SubFilter /adbe.pkcs7.detached");
  }, 60_000);
});
