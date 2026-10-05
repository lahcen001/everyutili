/**
 * Client-side data layer for the IPTV player tool. Fetches the public,
 * CORS-enabled iptv-org API (static JSON, no key required) directly from
 * the browser and joins channels <-> streams <-> logos into a flat list
 * ready for search/filter/playback.
 *
 * Deliberately fetched at runtime rather than bundled at build time: the
 * raw channels+streams payload is ~11MB combined and changes continuously
 * (community-maintained), so baking a snapshot into the app would both
 * bloat the bundle and go stale immediately.
 */

const API_BASE = "https://iptv-org.github.io/api";

interface RawChannel {
  id: string;
  name: string;
  country: string | null;
  categories: string[];
  is_nsfw: boolean;
  closed: string | null;
  replaced_by: string | null;
}

interface RawStream {
  channel: string | null;
  url: string;
  quality: string | null;
  user_agent: string | null;
  referrer: string | null;
}

interface RawLogo {
  channel: string;
  url: string;
}

interface RawCountry {
  name: string;
  code: string;
  flag: string;
}

interface RawCategory {
  id: string;
  name: string;
}

export interface IptvChannel {
  id: string;
  name: string;
  logo: string | null;
  countryCode: string | null;
  countryName: string | null;
  countryFlag: string | null;
  categories: string[];
  streamUrl: string;
  quality: string | null;
}

export interface IptvDirectory {
  channels: IptvChannel[];
  countries: { code: string; name: string; flag: string }[];
  categories: { id: string; name: string }[];
}

/** Streams needing custom headers can't be played from a plain browser <video>/hls.js. */
function isBrowserPlayable(stream: RawStream): boolean {
  return !stream.user_agent && !stream.referrer;
}

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}/${path}`);
  if (!res.ok) throw new Error(`Failed to fetch ${path}: ${res.status}`);
  return res.json() as Promise<T>;
}

let directoryPromise: Promise<IptvDirectory> | null = null;

/**
 * Loads and caches (module-scope, for the lifetime of the page) the
 * filtered, joined IPTV directory. Excludes closed/replaced channels,
 * NSFW/"xxx"-category channels, and streams that require headers a
 * browser can't set, so every entry returned is actually playable here.
 */
export function loadIptvDirectory(): Promise<IptvDirectory> {
  if (!directoryPromise) {
    directoryPromise = buildDirectory().catch((err) => {
      directoryPromise = null;
      throw err;
    });
  }
  return directoryPromise;
}

async function buildDirectory(): Promise<IptvDirectory> {
  const [channels, streams, logos, countries, categories] = await Promise.all([
    fetchJson<RawChannel[]>("channels.json"),
    fetchJson<RawStream[]>("streams.json"),
    fetchJson<RawLogo[]>("logos.json"),
    fetchJson<RawCountry[]>("countries.json"),
    fetchJson<RawCategory[]>("categories.json"),
  ]);

  const streamByChannel = new Map<string, RawStream>();
  for (const stream of streams) {
    if (!stream.channel || !isBrowserPlayable(stream)) continue;
    if (!streamByChannel.has(stream.channel)) streamByChannel.set(stream.channel, stream);
  }

  const logoByChannel = new Map<string, string>();
  for (const logo of logos) {
    if (!logoByChannel.has(logo.channel)) logoByChannel.set(logo.channel, logo.url);
  }

  const countryByCode = new Map(countries.map((c) => [c.code, c]));

  const result: IptvChannel[] = [];
  for (const channel of channels) {
    if (channel.closed || channel.replaced_by) continue;
    if (channel.is_nsfw || channel.categories.includes("xxx")) continue;

    const stream = streamByChannel.get(channel.id);
    if (!stream) continue;

    const country = channel.country ? countryByCode.get(channel.country) : undefined;

    result.push({
      id: channel.id,
      name: channel.name,
      logo: logoByChannel.get(channel.id) ?? null,
      countryCode: channel.country,
      countryName: country?.name ?? null,
      countryFlag: country?.flag ?? null,
      categories: channel.categories,
      streamUrl: stream.url,
      quality: stream.quality,
    });
  }

  result.sort((a, b) => a.name.localeCompare(b.name));

  const usedCountryCodes = new Set(result.map((c) => c.countryCode).filter(Boolean));
  const usedCategoryIds = new Set(result.flatMap((c) => c.categories));

  return {
    channels: result,
    countries: countries
      .filter((c) => usedCountryCodes.has(c.code))
      .map((c) => ({ code: c.code, name: c.name, flag: c.flag }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    categories: categories
      .filter((c) => usedCategoryIds.has(c.id))
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
}
