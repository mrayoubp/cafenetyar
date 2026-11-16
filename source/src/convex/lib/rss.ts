/**
 * Small, dependency-free RSS/Atom reader. It deliberately extracts plain text
 * only: no feed HTML is ever rendered in the app, which avoids injecting
 * untrusted markup into the dashboard.
 */

export type ParsedFeedItem = {
  externalId: string;
  title: string;
  summary: string;
  body: string;
  link?: string;
  imageUrl?: string;
  publishedAt: number;
};

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  laquo: "«",
  raquo: "»",
  hellip: "…",
};

function decodeEntities(value: string) {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, dec: string) =>
      String.fromCodePoint(Number.parseInt(dec, 10)),
    )
    .replace(/&([a-z]+);/gi, (match, name: string) => {
      return NAMED_ENTITIES[name.toLowerCase()] ?? match;
    });
}

function unwrap(value: string) {
  let text = value.trim();
  const cdata = text.match(/^<!\[CDATA\[([\s\S]*?)\]\]>$/);
  if (cdata) text = cdata[1];
  return text.trim();
}

export function stripHtml(value: string) {
  const cleaned = unwrap(value)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6]|blockquote)>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  return decodeEntities(cleaned)
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function getTag(block: string, names: string[]) {
  for (const name of names) {
    const match = block.match(
      new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, "i"),
    );
    if (match) {
      const text = stripHtml(match[1]);
      if (text) return text;
    }
  }
  return "";
}

function getAttribute(block: string, tagNames: string[], attribute: string) {
  for (const name of tagNames) {
    const tags = block.match(new RegExp(`<${name}\\b[^>]*>`, "gi")) ?? [];
    for (const tag of tags) {
      const match = tag.match(
        new RegExp(`${attribute}\\s*=\\s*["']([^"']+)["']`, "i"),
      );
      if (match) {
        const value = decodeEntities(match[1]).trim();
        if (/^https?:\/\//i.test(value)) return value;
      }
    }
  }
  return undefined;
}

function getAtomLink(block: string) {
  const links = block.match(/<link\b[^>]*>/gi) ?? [];
  for (const link of links) {
    const rel = link.match(/rel\s*=\s*["']([^"']+)["']/i)?.[1];
    if (rel && rel !== "alternate") continue;
    const href = link.match(/href\s*=\s*["']([^"']+)["']/i)?.[1];
    if (href && /^https?:\/\//i.test(decodeEntities(href))) {
      return decodeEntities(href).trim();
    }
  }
  return undefined;
}

function getLink(block: string, atom: boolean) {
  if (atom) {
    const atomLink = getAtomLink(block);
    if (atomLink) return atomLink;
  }
  const value = getTag(block, ["link"]);
  if (/^https?:\/\//i.test(value)) return value;
  return getAtomLink(block);
}

function getImage(block: string, content: string) {
  const direct = getAttribute(
    block,
    ["enclosure", "media:content", "media:thumbnail"],
    "url",
  );
  if (direct) return direct;
  const image = content.match(/<img\b[^>]*src\s*=\s*["']([^"']+)["']/i)?.[1];
  if (image && /^https?:\/\//i.test(image)) return image;
  return undefined;
}

function toTimestamp(value: string) {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function shorten(value: string, max: number) {
  const text = value.replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

export function parseFeed(xml: string): ParsedFeedItem[] {
  const source = xml.slice(0, 2_000_000);
  const isAtom = /<feed\b/i.test(source);
  const blocks = isAtom
    ? source.match(/<entry\b[^>]*>[\s\S]*?<\/entry>/gi) ?? []
    : source.match(/<item\b[^>]*>[\s\S]*?<\/item>/gi) ?? [];

  const items: ParsedFeedItem[] = [];
  for (const block of blocks.slice(0, 40)) {
    const contentHtml =
      block.match(
        /<content:encoded(?:\s[^>]*)?>([\s\S]*?)<\/content:encoded>/i,
      )?.[1] ??
      block.match(/<content(?:\s[^>]*)?>([\s\S]*?)<\/content>/i)?.[1] ??
      block.match(/<description(?:\s[^>]*)?>([\s\S]*?)<\/description>/i)?.[1] ??
      block.match(/<summary(?:\s[^>]*)?>([\s\S]*?)<\/summary>/i)?.[1] ??
      "";

    const body = stripHtml(contentHtml);
    const title = getTag(block, ["title"]);
    if (!title) continue;
    const link = getLink(block, isAtom);
    const guid = getTag(block, ["guid", "id"]);
    const date =
      getTag(block, ["pubDate", "published", "updated", "dc:date"]) ?? "";
    const publishedAt = toTimestamp(date);
    const externalId = (guid || link || `${title}-${publishedAt}`).slice(0, 900);
    const summary = shorten(body || title, 300);
    const imageUrl = getImage(block, contentHtml);

    items.push({
      externalId,
      title,
      summary,
      body: body || summary,
      link,
      imageUrl,
      publishedAt,
    });
  }
  return items;
}

/** Rejects obviously local destinations before a server-side fetch. */
export function assertPublicFeedUrl(raw: string) {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("نشانی فید معتبر نیست.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("نشانی فید باید http یا https باشد.");
  }
  if (url.username || url.password) {
    throw new Error("نشانی فید نباید نام کاربری یا رمز داشته باشد.");
  }
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (
    !host.includes(".") ||
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host === "0.0.0.0" ||
    host === "::1" ||
    host.endsWith(".local") ||
    host.startsWith("fc") ||
    host.startsWith("fd") ||
    host.startsWith("fe80") ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host)
  ) {
    throw new Error("نشانی فید باید یک منبع عمومی اینترنتی باشد.");
  }
  return url.toString();
}
