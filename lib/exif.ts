/**
 * Dependency-free EXIF reader. Scans a JPEG's APP1 segment for the
 * "Exif\0\0" marker, parses the embedded TIFF structure (IFD0, the
 * ExifIFD sub-block, and the GPS IFD), and pulls out the handful of
 * human-relevant tags this tool cares about.
 */

export interface ExifGpsCoordinates {
  latitude: number;
  longitude: number;
}

export interface ExifData {
  make: string | null;
  model: string | null;
  dateTime: string | null;
  iso: number | null;
  lensModel: string | null;
  gps: ExifGpsCoordinates | null;
}

const JPEG_SOI = 0xffd8;
const APP1_MARKER = 0xffe1;
const EXIF_HEADER = "Exif\0\0";

const TAG_MAKE = 0x010f;
const TAG_MODEL = 0x0110;
const TAG_DATETIME = 0x0132;
const TAG_EXIF_IFD_POINTER = 0x8769;
const TAG_GPS_IFD_POINTER = 0x8825;
const TAG_ISO = 0x8827;
const TAG_LENS_MODEL = 0xa434;

const TAG_GPS_LAT_REF = 0x0001;
const TAG_GPS_LAT = 0x0002;
const TAG_GPS_LON_REF = 0x0003;
const TAG_GPS_LON = 0x0004;

type ByteOrder = "II" | "MM";

interface IfdEntry {
  tag: number;
  type: number;
  count: number;
  valueOffset: number;
}

function readAscii(view: DataView, offset: number, length: number): string {
  const bytes: number[] = [];
  for (let i = 0; i < length; i++) {
    const byte = view.getUint8(offset + i);
    if (byte === 0) break;
    bytes.push(byte);
  }
  return String.fromCharCode(...bytes).trim();
}

function readIfdEntries(
  view: DataView,
  ifdOffset: number,
  tiffStart: number,
  littleEndian: boolean
): Map<number, IfdEntry> {
  const entries = new Map<number, IfdEntry>();
  const entryCount = view.getUint16(tiffStart + ifdOffset, littleEndian);

  for (let i = 0; i < entryCount; i++) {
    const entryOffset = tiffStart + ifdOffset + 2 + i * 12;
    if (entryOffset + 12 > view.byteLength) break;

    const tag = view.getUint16(entryOffset, littleEndian);
    const type = view.getUint16(entryOffset + 2, littleEndian);
    const count = view.getUint32(entryOffset + 4, littleEndian);
    const valueOffset = entryOffset + 8;

    entries.set(tag, { tag, type, count, valueOffset });
  }

  return entries;
}

function entryOffsetInBuffer(entry: IfdEntry, view: DataView, tiffStart: number, littleEndian: boolean): number {
  const typeSize = TYPE_SIZES[entry.type] ?? 1;
  const totalSize = typeSize * entry.count;
  if (totalSize <= 4) return entry.valueOffset;
  return tiffStart + view.getUint32(entry.valueOffset, littleEndian);
}

const TYPE_SIZES: Record<number, number> = {
  1: 1, // BYTE
  2: 1, // ASCII
  3: 2, // SHORT
  4: 4, // LONG
  5: 8, // RATIONAL
  9: 4, // SLONG
  10: 8, // SRATIONAL
};

function readEntryString(view: DataView, entry: IfdEntry, tiffStart: number, littleEndian: boolean): string | null {
  if (entry.type !== 2) return null;
  const offset = entryOffsetInBuffer(entry, view, tiffStart, littleEndian);
  const value = readAscii(view, offset, entry.count);
  return value || null;
}

function readEntryNumber(view: DataView, entry: IfdEntry, tiffStart: number, littleEndian: boolean): number | null {
  const offset = entryOffsetInBuffer(entry, view, tiffStart, littleEndian);
  switch (entry.type) {
    case 3:
      return view.getUint16(offset, littleEndian);
    case 4:
      return view.getUint32(offset, littleEndian);
    case 9:
      return view.getInt32(offset, littleEndian);
    default:
      return null;
  }
}

function readRational(view: DataView, offset: number, littleEndian: boolean): number {
  const numerator = view.getUint32(offset, littleEndian);
  const denominator = view.getUint32(offset + 4, littleEndian);
  return denominator === 0 ? 0 : numerator / denominator;
}

function readEntryRationalTriplet(
  view: DataView,
  entry: IfdEntry,
  tiffStart: number,
  littleEndian: boolean
): [number, number, number] | null {
  if (entry.type !== 5 || entry.count < 3) return null;
  const offset = entryOffsetInBuffer(entry, view, tiffStart, littleEndian);
  return [
    readRational(view, offset, littleEndian),
    readRational(view, offset + 8, littleEndian),
    readRational(view, offset + 16, littleEndian),
  ];
}

function dmsToDecimal(dms: [number, number, number], ref: string): number {
  const [degrees, minutes, seconds] = dms;
  const decimal = degrees + minutes / 60 + seconds / 3600;
  return ref === "S" || ref === "W" ? -decimal : decimal;
}

function findApp1Segment(view: DataView): number | null {
  if (view.getUint16(0, false) !== JPEG_SOI) return null;

  let offset = 2;
  while (offset + 4 <= view.byteLength) {
    const marker = view.getUint16(offset, false);
    if ((marker & 0xff00) !== 0xff00) break;

    const segmentLength = view.getUint16(offset + 2, false);

    if (marker === APP1_MARKER) {
      const headerStart = offset + 4;
      let isExif = true;
      for (let i = 0; i < EXIF_HEADER.length; i++) {
        if (view.getUint8(headerStart + i) !== EXIF_HEADER.charCodeAt(i)) {
          isExif = false;
          break;
        }
      }
      if (isExif) return headerStart + EXIF_HEADER.length;
    }

    if (marker === 0xffda) break; // Start of Scan — no more markers follow
    offset += 2 + segmentLength;
  }

  return null;
}

export function parseExif(buffer: ArrayBuffer): ExifData | null {
  const view = new DataView(buffer);
  const tiffStart = findApp1Segment(view);
  if (tiffStart === null) return null;

  const byteOrderMark = String.fromCharCode(view.getUint8(tiffStart), view.getUint8(tiffStart + 1));
  if (byteOrderMark !== "II" && byteOrderMark !== "MM") return null;
  const byteOrder: ByteOrder = byteOrderMark as ByteOrder;
  const littleEndian = byteOrder === "II";

  const magic = view.getUint16(tiffStart + 2, littleEndian);
  if (magic !== 42) return null;

  const ifd0Offset = view.getUint32(tiffStart + 4, littleEndian);
  const ifd0 = readIfdEntries(view, ifd0Offset, tiffStart, littleEndian);

  const make = ifd0.has(TAG_MAKE) ? readEntryString(view, ifd0.get(TAG_MAKE)!, tiffStart, littleEndian) : null;
  const model = ifd0.has(TAG_MODEL) ? readEntryString(view, ifd0.get(TAG_MODEL)!, tiffStart, littleEndian) : null;
  const dateTime = ifd0.has(TAG_DATETIME)
    ? readEntryString(view, ifd0.get(TAG_DATETIME)!, tiffStart, littleEndian)
    : null;

  let iso: number | null = null;
  let lensModel: string | null = null;
  if (ifd0.has(TAG_EXIF_IFD_POINTER)) {
    const exifIfdOffset = readEntryNumber(view, ifd0.get(TAG_EXIF_IFD_POINTER)!, tiffStart, littleEndian);
    if (exifIfdOffset !== null) {
      const exifIfd = readIfdEntries(view, exifIfdOffset, tiffStart, littleEndian);
      if (exifIfd.has(TAG_ISO)) iso = readEntryNumber(view, exifIfd.get(TAG_ISO)!, tiffStart, littleEndian);
      if (exifIfd.has(TAG_LENS_MODEL)) {
        lensModel = readEntryString(view, exifIfd.get(TAG_LENS_MODEL)!, tiffStart, littleEndian);
      }
    }
  }

  let gps: ExifGpsCoordinates | null = null;
  if (ifd0.has(TAG_GPS_IFD_POINTER)) {
    const gpsIfdOffset = readEntryNumber(view, ifd0.get(TAG_GPS_IFD_POINTER)!, tiffStart, littleEndian);
    if (gpsIfdOffset !== null) {
      const gpsIfd = readIfdEntries(view, gpsIfdOffset, tiffStart, littleEndian);
      const latEntry = gpsIfd.get(TAG_GPS_LAT);
      const latRefEntry = gpsIfd.get(TAG_GPS_LAT_REF);
      const lonEntry = gpsIfd.get(TAG_GPS_LON);
      const lonRefEntry = gpsIfd.get(TAG_GPS_LON_REF);

      if (latEntry && latRefEntry && lonEntry && lonRefEntry) {
        const latDms = readEntryRationalTriplet(view, latEntry, tiffStart, littleEndian);
        const lonDms = readEntryRationalTriplet(view, lonEntry, tiffStart, littleEndian);
        const latRef = readEntryString(view, latRefEntry, tiffStart, littleEndian);
        const lonRef = readEntryString(view, lonRefEntry, tiffStart, littleEndian);

        if (latDms && lonDms && latRef && lonRef) {
          gps = {
            latitude: dmsToDecimal(latDms, latRef),
            longitude: dmsToDecimal(lonDms, lonRef),
          };
        }
      }
    }
  }

  if (!make && !model && !dateTime && iso === null && !lensModel && !gps) return null;

  return { make, model, dateTime, iso, lensModel, gps };
}

export function formatGpsCoordinates(gps: ExifGpsCoordinates): string {
  const latLabel = gps.latitude >= 0 ? "N" : "S";
  const lonLabel = gps.longitude >= 0 ? "E" : "W";
  return `${Math.abs(gps.latitude).toFixed(6)}° ${latLabel}, ${Math.abs(gps.longitude).toFixed(6)}° ${lonLabel}`;
}
