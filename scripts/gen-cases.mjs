import fs from "node:fs";
import path from "node:path";

const inputPath = path.join("src", "data", "cases.tsv");
const outputPath = path.join("src", "data", "cases.generated.ts");
const thumbPosterDirName = "thumbposters";
const thumbPosterDirPath = path.join("public", thumbPosterDirName);
const defaultImagePlaceholder = "https://placehold.co/640x360";
const youtubeThumbnailHosts = new Set(["i.ytimg.com", "img.youtube.com"]);
const cachedYoutubeThumbnailPaths = new Map();

function getYoutubeThumbnailUrl(youtubeId) {
  return `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`;
}

function isYoutubeThumbnailUrl(value) {
  if (!value) return false;

  try {
    const url = new URL(value);
    return youtubeThumbnailHosts.has(url.hostname.replace(/^www\./, ""));
  } catch {
    return false;
  }
}

function sanitizeFilenamePart(value) {
  return value.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/-+/g, "-");
}

function getThumbPosterLocation(sourceUrl, fallbackId) {
  const url = new URL(sourceUrl);
  const pathSegments = url.pathname.split("/").filter(Boolean);
  const basename = path.posix.basename(url.pathname);
  const extension = path.posix.extname(basename) || ".jpg";
  const basenameWithoutExtension = basename.slice(0, basename.length - extension.length) || "thumbnail";
  const youtubeId =
    pathSegments[pathSegments.indexOf("vi") + 1] ||
    pathSegments[pathSegments.indexOf("vi_webp") + 1] ||
    fallbackId ||
    "youtube";
  const filename = `${sanitizeFilenamePart(youtubeId)}-${sanitizeFilenamePart(basenameWithoutExtension)}${extension}`;

  return {
    diskPath: path.join(thumbPosterDirPath, filename),
    publicPath: `/${thumbPosterDirName}/${filename}`,
  };
}

async function cacheYoutubeThumbnail(sourceUrl, fallbackId, label) {
  if (!isYoutubeThumbnailUrl(sourceUrl)) {
    return sourceUrl;
  }

  const existing = cachedYoutubeThumbnailPaths.get(sourceUrl);
  if (existing) {
    return existing;
  }

  const { diskPath, publicPath } = getThumbPosterLocation(sourceUrl, fallbackId);
  if (fs.existsSync(diskPath)) {
    cachedYoutubeThumbnailPaths.set(sourceUrl, publicPath);
    return publicPath;
  }

  fs.mkdirSync(thumbPosterDirPath, { recursive: true });

  try {
    const response = await fetch(sourceUrl);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(diskPath, buffer);
    cachedYoutubeThumbnailPaths.set(sourceUrl, publicPath);
    console.log(`Cached ${label}: ${publicPath}`);
    return publicPath;
  } catch (error) {
    console.warn(`Failed to cache ${label} from ${sourceUrl}: ${error.message}`);
    cachedYoutubeThumbnailPaths.set(sourceUrl, sourceUrl);
    return sourceUrl;
  }
}

async function resolveThumbnailAsset(sourceUrl, fallbackYoutubeId, label) {
  if (!sourceUrl) return "";
  return cacheYoutubeThumbnail(sourceUrl, fallbackYoutubeId, label);
}

const requiredHeaders = [
  "subtitle",
  "copy",
  "youtubeId",
  "href",
  "videoSrc",
  "imageSrc",
  "imageAlt",
  "videoPoster",
];

function fail(message) {
  console.error(`cases.tsv: ${message}`);
  process.exit(1);
}

function ensure(condition, message) {
  if (!condition) fail(message);
}

function parseOptionalBoolean(value, label) {
  if (!value) return undefined;
  if (/^(true|1|yes|y)$/i.test(value)) return true;
  if (/^(false|0|no|n)$/i.test(value)) return false;
  fail(`${label} must be true/false.`);
}

function parseOptionalNumber(value, label) {
  if (!value) return undefined;
  const parsed = Number(value);
  ensure(Number.isFinite(parsed), `${label} must be a valid number.`);
  return parsed;
}

function normalizeHeaderName(name) {
  return name.trim().replace(/^\uFEFF/, "").toLowerCase();
}

const raw = fs.readFileSync(inputPath, "utf8");
const lines = raw.split(/\r?\n/).filter((line) => line.trim().length > 0);

ensure(lines.length > 1, "no data rows found.");

const headers = lines[0].split("\t").map((header) => normalizeHeaderName(header));
const headerIndex = Object.fromEntries(headers.map((header, index) => [header, index]));
const aliases = {
  id: ["id_slug", "slugid", "slug_id", "slug", "id"],
  seriesId: ["seriesid", "series_id", "series"],
  sourceHref: ["sourcehref", "source_href"],
  videoOrder: ["videoorder", "video_order"],
  publishedAt: ["publishedat", "published_at"],
  vertical: ["vertical", "isvertical", "is_vertical"],
};

const missingHeaders = requiredHeaders.filter(
  (header) => headerIndex[normalizeHeaderName(header)] === undefined,
);
ensure(missingHeaders.length === 0, `missing headers: ${missingHeaders.join(", ")}`);
ensure(
  aliases.id.some((name) => headerIndex[name] !== undefined),
  "missing id column: expected id_slug (or legacy id).",
);

const seenIds = new Set();
const cases = [];

for (let i = 1; i < lines.length; i += 1) {
  const lineNumber = i + 1;
  const cells = lines[i].split("\t", -1);
  const get = (name) => {
    const index = headerIndex[normalizeHeaderName(name)];
    return index === undefined ? "" : (cells[index] ?? "").trim();
  };
  const getAny = (names) => {
    for (const name of names) {
      const value = get(name);
      if (value) return value;
    }
    return "";
  };

  const id = getAny(aliases.id);
  const title = get("title");
  const subtitle = get("subtitle");
  const roles = get("roles");
  const copy = get("copy");
  const youtubeId = get("youtubeId");
  const hrefRaw = get("href");
  const videoSrcRaw = get("videoSrc");
  const imageSrcRaw = get("imageSrc");
  const imageAltRaw = get("imageAlt");
  const videoPoster = get("videoPoster");
  const seriesId = getAny(aliases.seriesId);
  const sourceHref = getAny(aliases.sourceHref);
  const videoOrder = parseOptionalNumber(
    getAny(aliases.videoOrder),
    `line ${lineNumber}: videoOrder`,
  );
  const publishedAt = getAny(aliases.publishedAt);
  const vertical = parseOptionalBoolean(
    getAny(aliases.vertical),
    `line ${lineNumber}: vertical`,
  );

  ensure(id, `line ${lineNumber}: id is required.`);
  ensure(!seenIds.has(id), `line ${lineNumber}: duplicate id "${id}".`);
  seenIds.add(id);

  if (youtubeId) {
    ensure(
      /^[A-Za-z0-9_-]{11}$/.test(youtubeId),
      `line ${lineNumber}: youtubeId must be 11 URL-safe characters.`,
    );
  }

  if (publishedAt) {
    ensure(
      !Number.isNaN(Date.parse(publishedAt)),
      `line ${lineNumber}: publishedAt must be an ISO-compatible date.`,
    );
  }

  const href = hrefRaw || (youtubeId ? `https://www.youtube.com/watch?v=${youtubeId}` : "");

  let media;
  if (videoSrcRaw) {
    media = { kind: "video", src: videoSrcRaw };
    const poster = await resolveThumbnailAsset(
      videoPoster || (youtubeId ? getYoutubeThumbnailUrl(youtubeId) : ""),
      youtubeId || id,
      `video poster for ${id}`,
    );
    if (poster) {
      media.poster = poster;
    }
  } else if (imageSrcRaw || youtubeId) {
    const src = await resolveThumbnailAsset(
      imageSrcRaw || getYoutubeThumbnailUrl(youtubeId),
      youtubeId || id,
      `image thumbnail for ${id}`,
    );
    const altBase = title || subtitle || id;
    const alt = imageAltRaw || `${altBase} thumbnail`;
    media = { kind: "image", src, alt };
  } else {
    const altBase = title || subtitle || id;
    media = {
      kind: "image",
      src: defaultImagePlaceholder,
      alt: imageAltRaw || `${altBase} placeholder`,
    };
  }

  const entry = { id, media };

  if (title) entry.title = title;
  if (subtitle) entry.subtitle = subtitle;
  if (roles) entry.roles = roles;
  if (copy) entry.copy = copy;
  if (youtubeId) entry.youtubeId = youtubeId;
  if (href) entry.href = href;
  if (seriesId) entry.seriesId = seriesId;
  if (sourceHref) entry.sourceHref = sourceHref;
  if (videoOrder !== undefined) entry.videoOrder = videoOrder;
  if (publishedAt) entry.publishedAt = publishedAt;
  if (vertical !== undefined) entry.vertical = vertical;

  cases.push(entry);
}

const output = [
  "// Generated by scripts/gen-cases.mjs. Do not edit directly.",
  'import type { Case } from "./cases";',
  "",
  `export const CASES: Case[] = ${JSON.stringify(cases, null, 2)};`,
  "",
].join("\n");

fs.writeFileSync(outputPath, output, "utf8");
