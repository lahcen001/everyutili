import forge from "node-forge";
import { PDFArray, PDFDict, PDFDocument, PDFHexString, PDFName, PDFNumber, PDFString, StandardFonts, rgb } from "pdf-lib";

/** Bytes reserved for the PKCS#7 blob. 16 KB fits a certificate chain with room to spare. */
const SIGNATURE_BYTES = 16384;
const RANGE_PLACEHOLDER = 9999999999;

export interface Identity {
  key: forge.pki.rsa.PrivateKey;
  cert: forge.pki.Certificate;
  chain: forge.pki.Certificate[];
}

export interface DigitalSignOptions {
  p12: Uint8Array;
  password: string;
  reason?: string;
  location?: string;
  contact?: string;
  /** Draw a visible "Digitally signed by…" box on the last page. */
  visible?: "none" | "bottom-left" | "bottom-right";
  now?: Date;
}

const toBinary = (bytes: Uint8Array): string => {
  let out = "";
  for (let i = 0; i < bytes.length; i += 0x8000) out += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return out;
};
const fromBinary = (s: string): Uint8Array => Uint8Array.from(s, (c) => c.charCodeAt(0));

export function commonName(cert: forge.pki.Certificate): string {
  return (cert.subject.getField("CN")?.value as string | undefined) ?? "Unknown signer";
}

/** Reads a .p12 / .pfx bundle. Throws a readable error for a wrong password or bad file. */
export function readIdentity(p12: Uint8Array, password: string): Identity {
  let bundle: forge.pkcs12.Pkcs12Pfx;
  try {
    bundle = forge.pkcs12.pkcs12FromAsn1(forge.asn1.fromDer(toBinary(p12)), false, password);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (/password|MAC/i.test(msg)) throw new Error("Wrong certificate password.");
    throw new Error("This is not a valid .p12 / .pfx certificate file.");
  }
  const keyBags = [
    ...(bundle.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag] ?? []),
    ...(bundle.getBags({ bagType: forge.pki.oids.keyBag })[forge.pki.oids.keyBag] ?? []),
  ];
  const key = keyBags[0]?.key as forge.pki.rsa.PrivateKey | undefined;
  const certs = (bundle.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] ?? [])
    .map((b) => b.cert)
    .filter((c): c is forge.pki.Certificate => !!c);
  if (!key || certs.length === 0) throw new Error("The certificate file has no private key or certificate.");
  // The signer is the certificate whose public key matches the private key.
  const modulus = (key as unknown as { n: forge.jsbn.BigInteger }).n.toString(16);
  const cert = certs.find((c) => (c.publicKey as forge.pki.rsa.PublicKey).n.toString(16) === modulus) ?? certs[0];
  return { key, cert, chain: certs.filter((c) => c !== cert) };
}

export interface SelfSignedInput {
  name: string;
  email?: string;
  organization?: string;
  years?: number;
  password: string;
}

/** Creates a new RSA-2048 self-signed certificate and returns it as a password-protected .p12. */
export async function createSelfSignedP12(input: SelfSignedInput): Promise<{ p12: Uint8Array; expires: Date }> {
  const keys = await new Promise<forge.pki.rsa.KeyPair>((resolve, reject) =>
    forge.pki.rsa.generateKeyPair({ bits: 2048, workers: 0 }, (err, pair) => (err ? reject(err) : resolve(pair)))
  );
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = "01" + forge.util.bytesToHex(forge.random.getBytesSync(8));
  cert.validity.notBefore = new Date(Date.now() - 60_000);
  cert.validity.notAfter = new Date(Date.now() + (input.years ?? 3) * 365 * 24 * 3600 * 1000);
  const attrs: forge.pki.CertificateField[] = [{ name: "commonName", value: input.name }];
  if (input.organization) attrs.push({ name: "organizationName", value: input.organization });
  if (input.email) attrs.push({ name: "emailAddress", value: input.email });
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.setExtensions([
    { name: "basicConstraints", cA: false },
    { name: "keyUsage", digitalSignature: true, nonRepudiation: true },
    { name: "extKeyUsage", emailProtection: true },
  ]);
  cert.sign(keys.privateKey, forge.md.sha256.create());
  const asn1 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert], input.password, { algorithm: "3des", friendlyName: input.name });
  return { p12: fromBinary(forge.asn1.toDer(asn1).getBytes()), expires: cert.validity.notAfter };
}

const pdfDate = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, "0");
  return `D:${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`;
};

/** Pure-ASCII text so the built-in Helvetica font can draw it. */
const ascii = (s: string) => s.normalize("NFKD").replace(/[^\x20-\x7e]/g, "");

/**
 * Adds a real PAdES-style (adbe.pkcs7.detached) signature to the PDF using the supplied certificate.
 * Any later change to the file invalidates the signature, which is how readers detect tampering.
 */
export async function signPdfDigitally(pdf: Uint8Array, options: DigitalSignOptions): Promise<Uint8Array> {
  const identity = readIdentity(options.p12, options.password);
  const now = options.now ?? new Date();
  const signer = commonName(identity.cert);

  const doc = await PDFDocument.load(pdf, { ignoreEncryption: false, updateMetadata: false });
  const ctx = doc.context;
  const pages = doc.getPages();
  const page = pages[pages.length - 1];

  let rect: [number, number, number, number] = [0, 0, 0, 0];
  if (options.visible && options.visible !== "none") {
    const { width } = page.getSize();
    const w = Math.min(230, width - 40);
    const h = 54;
    const x = options.visible === "bottom-left" ? 20 : width - w - 20;
    rect = [x, 20, x + w, 20 + h];
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    page.drawRectangle({ x, y: 20, width: w, height: h, color: rgb(0.96, 0.98, 1), borderColor: rgb(0.2, 0.4, 0.8), borderWidth: 0.8 });
    page.drawText("Digitally signed by", { x: x + 8, y: 20 + h - 14, size: 7.5, font, color: rgb(0.35, 0.35, 0.4) });
    page.drawText(ascii(signer).slice(0, 38) || "Signer", { x: x + 8, y: 20 + h - 28, size: 11, font: bold, color: rgb(0.1, 0.15, 0.3) });
    page.drawText(`Date: ${now.toISOString().replace("T", " ").slice(0, 19)} UTC`, { x: x + 8, y: 20 + h - 40, size: 7.5, font, color: rgb(0.35, 0.35, 0.4) });
    if (options.reason) page.drawText(ascii(`Reason: ${options.reason}`).slice(0, 52), { x: x + 8, y: 20 + h - 50, size: 7, font, color: rgb(0.35, 0.35, 0.4) });
  }

  const sigEntries: Record<string, unknown> = {
    Type: "Sig",
    Filter: "Adobe.PPKLite",
    SubFilter: "adbe.pkcs7.detached",
    ByteRange: ctx.obj([0, RANGE_PLACEHOLDER, RANGE_PLACEHOLDER, RANGE_PLACEHOLDER]),
    Contents: PDFHexString.of("0".repeat(SIGNATURE_BYTES * 2)),
    M: PDFString.of(pdfDate(now)),
    Name: PDFString.of(ascii(signer)),
  };
  if (options.reason) sigEntries.Reason = PDFString.of(ascii(options.reason));
  if (options.location) sigEntries.Location = PDFString.of(ascii(options.location));
  if (options.contact) sigEntries.ContactInfo = PDFString.of(ascii(options.contact));
  const sigRef = ctx.register(ctx.obj(sigEntries as Parameters<typeof ctx.obj>[0]));

  const widgetRef = ctx.register(
    ctx.obj({
      Type: "Annot",
      Subtype: "Widget",
      FT: "Sig",
      Rect: rect,
      V: sigRef,
      T: PDFString.of(`Signature${Date.now().toString(36)}`),
      F: 132,
      P: page.ref,
    })
  );
  const annots = page.node.lookupMaybe(PDFName.of("Annots"), PDFArray);
  if (annots) annots.push(widgetRef);
  else page.node.set(PDFName.of("Annots"), ctx.obj([widgetRef]));

  const catalog = doc.catalog;
  let acro = catalog.lookupMaybe(PDFName.of("AcroForm"), PDFDict);
  if (!acro) {
    acro = ctx.obj({ Fields: [] }) as PDFDict;
    catalog.set(PDFName.of("AcroForm"), acro);
  }
  const fields = acro.lookupMaybe(PDFName.of("Fields"), PDFArray) ?? (ctx.obj([]) as PDFArray);
  fields.push(widgetRef);
  acro.set(PDFName.of("Fields"), fields);
  acro.set(PDFName.of("SigFlags"), PDFNumber.of(3));

  const saved = await doc.save({ useObjectStreams: false });
  const text = toBinary(saved);

  const rangeAt = text.search(/\/ByteRange\s*\[\s*0\s+9999999999\s+9999999999\s+9999999999\s*\]/);
  const contentsAt = text.indexOf(`/Contents <${"0".repeat(64)}`);
  if (rangeAt < 0 || contentsAt < 0) throw new Error("Could not prepare the signature field.");
  const open = text.indexOf("<", contentsAt);
  const close = text.indexOf(">", open) + 1;
  const total = saved.length;
  const range = [0, open, close, total - close];
  const rangeText = `/ByteRange [0 ${String(range[1]).padEnd(10)} ${String(range[2]).padEnd(10)} ${String(range[3]).padEnd(10)}]`;
  const original = text.slice(rangeAt).match(/^\/ByteRange\s*\[[^\]]*\]/)![0];
  const head = text.slice(0, rangeAt) + rangeText.padEnd(original.length) + text.slice(rangeAt + original.length);

  const signedBytes = head.slice(0, open) + head.slice(close);

  const p7 = forge.pkcs7.createSignedData();
  p7.content = forge.util.createBuffer(signedBytes);
  p7.addCertificate(identity.cert);
  identity.chain.forEach((c) => p7.addCertificate(c));
  p7.addSigner({
    key: identity.key,
    certificate: identity.cert,
    digestAlgorithm: forge.pki.oids.sha256,
    authenticatedAttributes: [
      { type: forge.pki.oids.contentType, value: forge.pki.oids.data },
      { type: forge.pki.oids.messageDigest },
      { type: forge.pki.oids.signingTime, value: now as unknown as string },
    ],
  });
  p7.sign({ detached: true });
  const der = forge.asn1.toDer(p7.toAsn1()).getBytes();
  if (der.length > SIGNATURE_BYTES) throw new Error("The certificate chain is too large to embed.");

  const hex = forge.util.bytesToHex(der).padEnd(SIGNATURE_BYTES * 2, "0");
  const out = head.slice(0, open) + `<${hex}>` + head.slice(close);
  return fromBinary(out);
}
