import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const FEED_URL = "https://medium.com/feed/andys-coding-blog";
const FEED_PROXY_URL = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(FEED_URL)}`;
const CONTENT_DIR = path.join(process.cwd(), "src", "content", "blog");
const OFFLINE_DIR = path.join(process.cwd(), "offline assets");
const PUBLIC_DIR = path.join(process.cwd(), "public");
const MEDIUM_ASSET_DIR = path.join(PUBLIC_DIR, "medium");
const FEED_CACHE_PATH = path.join(OFFLINE_DIR, "medium-feed-cache.txt");
const HERO_FALLBACK = "/blog-placeholder-1.jpg";
const MEDIUM_ATTRIBUTION_TEXT =
  "on Medium, where people are continuing the conversation by highlighting and responding to this story.";
const KNOWN_MEDIUM_EMBEDS = new Map([
  [
    "1835e4bb3d20d09f965c9a7497b19ef8",
    {
      kind: "youtube",
      url: "https://www.youtube.com/watch?v=iTKoGBXQ6gA",
      title: "How to Stream Canon R5C, R5 II & RED Cameras to Meta Quest 3 in Real-Time VR180 | Masterclass",
    },
  ],
  [
    "9f4eed99a10476888b8e42a1e29181a0",
    {
      kind: "youtube",
      url: "https://www.youtube.com/watch?v=K91eI6mPlgg",
      title: "Things I Learned, Loved, and Hated after Vibecoding a Website for a Year",
    },
  ],
]);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function fetchTextViaCurl(url) {
  const tempPath = path.join(os.tmpdir(), `medium-feed-${Date.now()}.xml`);

  try {
    execFileSync("curl", ["-L", "-A", "Mozilla/5.0", "-sS", url, "-o", tempPath], {
      stdio: "ignore",
    });
    return fs.readFileSync(tempPath, "utf8");
  } finally {
    if (fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }
  }
}

function downloadBinaryViaCurl(url) {
  const tempPath = path.join(os.tmpdir(), `medium-asset-${Date.now()}`);

  try {
    execFileSync("curl", ["-L", "-A", "Mozilla/5.0", "-sS", url, "-o", tempPath], {
      stdio: "ignore",
    });
    return fs.readFileSync(tempPath);
  } finally {
    if (fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }
  }
}

function sanitizeFilenamePart(value) {
  return value
    .normalize("NFKD")
    .replace(/[^\x00-\x7F]/g, "")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function decodeHtmlEntities(value) {
  const namedEntities = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: '"',
    rsquo: "'",
    lsquo: "'",
    rdquo: '"',
    ldquo: '"',
    ndash: "-",
    mdash: "-",
    hellip: "...",
  };

  return value.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, entity) => {
    if (entity.startsWith("#x") || entity.startsWith("#X")) {
      const codePoint = Number.parseInt(entity.slice(2), 16);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match;
    }

    if (entity.startsWith("#")) {
      const codePoint = Number.parseInt(entity.slice(1), 10);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match;
    }

    return namedEntities[entity] ?? match;
  });
}

function stripTags(value) {
  return decodeHtmlEntities(
    value
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<\/p>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/\s+/g, " ")
    .trim();
}

function extractTagValue(block, tagName) {
  const cdataMatch = block.match(
    new RegExp(`<${tagName}>(<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>)<\\/${tagName}>`, "i"),
  );
  if (cdataMatch) {
    return cdataMatch[2].trim();
  }

  const plainMatch = block.match(new RegExp(`<${tagName}>([\\s\\S]*?)<\\/${tagName}>`, "i"));
  return plainMatch ? decodeHtmlEntities(plainMatch[1].trim()) : "";
}

function extractAllCdataTagValues(block, tagName) {
  const matches = block.matchAll(
    new RegExp(`<${tagName}><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tagName}>`, "gi"),
  );
  return Array.from(matches, (match) => match[1].trim()).filter(Boolean);
}

function parseFeed(xml) {
  const itemMatches = xml.matchAll(/<item>([\s\S]*?)<\/item>/g);
  const items = [];

  for (const [, block] of itemMatches) {
    const link = extractTagValue(block, "link");
    const canonicalUrl = new URL(link);
    canonicalUrl.search = "";

    const slugWithId = canonicalUrl.pathname.split("/").filter(Boolean).at(-1) ?? "";
    const slug = slugWithId.replace(/-[a-f0-9]{12}$/i, "");
    if (!slug) {
      throw new Error(`Unable to derive slug from ${canonicalUrl.href}`);
    }

    items.push({
      canonicalUrl: canonicalUrl.href,
      slug,
      title: extractTagValue(block, "title"),
      pubDate: extractTagValue(block, "pubDate"),
      updatedDate: extractTagValue(block, "atom:updated"),
      categories: extractAllCdataTagValues(block, "category"),
      contentHtml: extractTagValue(block, "content:encoded"),
    });
  }

  return items;
}

function parseRss2Json(payload) {
  const data = JSON.parse(payload);
  if (data.status !== "ok" || !Array.isArray(data.items)) {
    throw new Error("rss2json returned an unexpected payload");
  }

  return data.items.map((item) => {
    const canonicalUrl = new URL(item.link);
    canonicalUrl.search = "";

    const slugWithId = canonicalUrl.pathname.split("/").filter(Boolean).at(-1) ?? "";
    const slug = slugWithId.replace(/-[a-f0-9]{12}$/i, "");
    if (!slug) {
      throw new Error(`Unable to derive slug from ${canonicalUrl.href}`);
    }

    return {
      canonicalUrl: canonicalUrl.href,
      slug,
      title: item.title,
      pubDate: item.pubDate,
      updatedDate: item.pubDate,
      categories: Array.isArray(item.categories) ? item.categories : [],
      contentHtml: item.content || item.description || "",
    };
  });
}

function normalizeArticleHtml(html, canonicalUrl) {
  let cleaned = html.trim();

  cleaned = cleaned.replace(
    /<img\b[^>]*\bsrc="https:\/\/medium\.com\/_\/stat[^"]*"[^>]*>\s*/gi,
    "",
  );

  cleaned = cleaned.replace(
    new RegExp(
      `<hr>\\s*<p><a href="${canonicalUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"[\\s\\S]*?${MEDIUM_ATTRIBUTION_TEXT.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}<\\/p>\\s*$`,
      "i",
    ),
    "",
  );

  cleaned = cleaned.replace(
    /<a href="https:\/\/medium\.com\/media\/([a-f0-9]+)\/href">https:\/\/medium\.com\/media\/[^<]+<\/a>/gi,
    (match, mediaId) => renderMediumEmbedHtml(mediaId, canonicalUrl),
  );

  cleaned = cleaned.replace(/\s+$/g, "");
  return cleaned;
}

function normalizeVoidTagsForMdx(html) {
  return html.replace(/<(br|hr|img)(\s[^>]*?)?>/gi, (match, tagName, attrs = "") => {
    return match.endsWith("/>") ? match : `<${tagName}${attrs} />`;
  });
}

function getYoutubeId(url) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");
    if (host === "youtu.be") {
      return parsed.pathname.slice(1);
    }
    if (host === "youtube.com" || host === "m.youtube.com") {
      if (parsed.pathname.startsWith("/embed/")) {
        return parsed.pathname.split("/")[2] ?? "";
      }
      return parsed.searchParams.get("v") ?? "";
    }
  } catch {}

  return "";
}

function renderMediumEmbedHtml(mediaId, canonicalUrl) {
  const embed = KNOWN_MEDIUM_EMBEDS.get(mediaId);

  if (!embed) {
    return `<p><a href="${canonicalUrl}">View the original embedded media on Medium.</a></p>`;
  }

  if (embed.kind === "youtube") {
    const youtubeId = getYoutubeId(embed.url);
    if (!youtubeId) {
      return `<p><a href="${embed.url}">${embed.title}</a></p>`;
    }

    return [
      `<div style="position: relative; width: 100%; margin: 1.5rem 0; padding-top: 56.25%;">`,
      `<iframe src="https://www.youtube.com/embed/${youtubeId}" title="${embed.title.replaceAll('"', "&quot;")}"`,
      ` style="position: absolute; inset: 0; width: 100%; height: 100%; border: 0;"`,
      ` loading="lazy"`,
      ` allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"`,
      ` referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>`,
      `</div>`,
    ].join("");
  }

  return `<p><a href="${embed.url}">${embed.title}</a></p>`;
}

function escapeMdxTextHazards(html) {
  return html.replaceAll("{", "&#123;").replaceAll("}", "&#125;");
}

function collectImageUrls(html) {
  const matches = html.matchAll(/<img\b[^>]*\bsrc="([^"]+)"[^>]*>/gi);
  const urls = [];

  for (const [, src] of matches) {
    if (!src.startsWith("http://") && !src.startsWith("https://")) {
      continue;
    }

    if (/https:\/\/medium\.com\/_\/stat/i.test(src)) {
      continue;
    }

    urls.push(src);
  }

  return [...new Set(urls)];
}

function normalizeMediumImageUrl(url) {
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== "cdn-images-1.medium.com") {
      return url;
    }

    const match = parsed.pathname.match(/^\/max\/([^/]+)\/(.+)$/);
    if (!match) {
      return url;
    }

    const [, size, assetPath] = match;
    return `https://miro.medium.com/v2/resize:fit:${size}/${assetPath}`;
  } catch {
    return url;
  }
}

function bufferLooksLikeHtml(buffer) {
  const prefix = buffer.subarray(0, 256).toString("utf8").trimStart().toLowerCase();
  return prefix.startsWith("<!doctype html") || prefix.startsWith("<html");
}

function getFileExtension(url, contentType) {
  const contentTypeToExtension = {
    "image/gif": ".gif",
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/png": ".png",
    "image/svg+xml": ".svg",
    "image/webp": ".webp",
  };

  if (contentType && contentTypeToExtension[contentType.toLowerCase()]) {
    return contentTypeToExtension[contentType.toLowerCase()];
  }

  try {
    const pathname = new URL(url).pathname;
    const ext = path.posix.extname(pathname);
    return ext || ".img";
  } catch {
    return ".img";
  }
}

async function downloadImages(postSlug, html) {
  const assetDir = path.join(MEDIUM_ASSET_DIR, postSlug);
  ensureDir(assetDir);

  const srcMap = new Map();
  const imageUrls = collectImageUrls(html);

  for (const [index, imageUrl] of imageUrls.entries()) {
    const prefix = `${String(index + 1).padStart(2, "0")}-`;
    const existingFilename = fs
      .readdirSync(assetDir)
      .find((filename) => filename.startsWith(prefix));

    if (existingFilename) {
      srcMap.set(imageUrl, `/medium/${postSlug}/${existingFilename}`);
      continue;
    }

    const candidateUrls = [...new Set([normalizeMediumImageUrl(imageUrl), imageUrl])];
    let contentType = "";
    let buffer;
    let lastError;

    for (const candidateUrl of candidateUrls) {
      let response;

      for (let attempt = 1; attempt <= 5; attempt += 1) {
        try {
          response = await fetch(candidateUrl, {
            headers: {
              "user-agent": "astro-blog-medium-importer/1.0",
            },
          });

          if (!response.ok) {
            lastError = new Error(`HTTP ${response.status}`);
          } else {
            contentType = response.headers.get("content-type")?.split(";")[0] ?? "";
            buffer = Buffer.from(await response.arrayBuffer());

            if (!contentType.startsWith("image/") || bufferLooksLikeHtml(buffer)) {
              lastError = new Error(`Unexpected response body for ${candidateUrl}`);
              buffer = undefined;
            } else {
              break;
            }
          }
        } catch (error) {
          lastError = error;
        }

        if (attempt < 5) {
          await sleep(750 * 2 ** (attempt - 1));
        }
      }

      if (buffer) {
        break;
      }

      try {
        buffer = downloadBinaryViaCurl(candidateUrl);
        if (bufferLooksLikeHtml(buffer)) {
          lastError = new Error(`Unexpected HTML response for ${candidateUrl}`);
          buffer = undefined;
        } else {
          contentType = contentType || "";
          break;
        }
      } catch (error) {
        lastError = error;
      }
    }

    const extension = getFileExtension(imageUrl, contentType);

    const urlPath = new URL(imageUrl).pathname;
    const basename = path.posix.basename(urlPath, path.posix.extname(urlPath)) || "image";
    const filename = `${String(index + 1).padStart(2, "0")}-${sanitizeFilenamePart(basename) || "image"}${extension}`;
    const diskPath = path.join(assetDir, filename);
    const publicPath = `/medium/${postSlug}/${filename}`;

    if (!buffer) {
      throw new Error(
        `Failed to download ${imageUrl}: ${lastError instanceof Error ? lastError.message : String(lastError)}`,
      );
    }

    fs.writeFileSync(diskPath, buffer);
    srcMap.set(imageUrl, publicPath);
    await sleep(250);
  }

  return srcMap;
}

function rewriteImageSources(html, sourceMap) {
  return html.replace(/(<img\b[^>]*\bsrc=")([^"]+)(")/gi, (match, prefix, src, suffix) => {
    return `${prefix}${sourceMap.get(src) ?? src}${suffix}`;
  });
}

function deriveDescription(html) {
  const paragraphMatches = html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi);
  const paragraphs = [];

  for (const [, innerHtml] of paragraphMatches) {
    const text = stripTags(innerHtml);
    if (text) {
      paragraphs.push(text);
    }
  }

  const preferred =
    paragraphs.find((text) => text.length >= 40 && !/^\d{1,2}\/\d{1,2}\/\d{4}:?$/.test(text)) ??
    paragraphs[0] ??
    "Imported from Medium.";

  return preferred.length > 180 ? `${preferred.slice(0, 177).trimEnd()}...` : preferred;
}

function pickHeroImage(localHtml) {
  const match = localHtml.match(/<img\b[^>]*\bsrc="([^"]+)"[^>]*>/i);
  return match?.[1] ?? HERO_FALLBACK;
}

function toYamlString(value) {
  return JSON.stringify(value ?? "");
}

function formatDate(value) {
  return new Date(value).toISOString();
}

function shouldIncludeUpdatedDate(pubDate, updatedDate) {
  if (!updatedDate) return false;
  const publishedAt = new Date(pubDate).getTime();
  const updatedAt = new Date(updatedDate).getTime();
  return Number.isFinite(publishedAt) && Number.isFinite(updatedAt) && updatedAt - publishedAt > 60_000;
}

function buildMdx(post, localHtml) {
  const frontmatter = [
    "---",
    `title: ${toYamlString(post.title)}`,
    `description: ${toYamlString(deriveDescription(localHtml))}`,
    `pubDate: ${toYamlString(formatDate(post.pubDate))}`,
    shouldIncludeUpdatedDate(post.pubDate, post.updatedDate)
      ? `updatedDate: ${toYamlString(formatDate(post.updatedDate))}`
      : null,
    `heroImage: ${toYamlString(pickHeroImage(localHtml))}`,
    "---",
    "",
    localHtml.trim(),
    "",
  ]
    .filter(Boolean)
    .join("\n");

  return frontmatter;
}

async function main() {
  ensureDir(CONTENT_DIR);
  ensureDir(MEDIUM_ASSET_DIR);
  ensureDir(OFFLINE_DIR);

  let feedPayload = "";

  try {
    const response = await fetch(FEED_URL, {
      headers: {
        "user-agent": "Mozilla/5.0",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    feedPayload = await response.text();
  } catch (error) {
    try {
      feedPayload = fetchTextViaCurl(FEED_URL);
    } catch (curlError) {
      feedPayload = "";
    }
  }

  if (!/<rss[\s>]/i.test(feedPayload)) {
    try {
      const proxyResponse = await fetch(FEED_PROXY_URL, {
        headers: {
          "user-agent": "Mozilla/5.0",
        },
      });

      if (!proxyResponse.ok) {
        throw new Error(`HTTP ${proxyResponse.status}`);
      }

      feedPayload = await proxyResponse.text();
    } catch (error) {
      try {
        feedPayload = fetchTextViaCurl(FEED_PROXY_URL);
      } catch (curlError) {
        if (fs.existsSync(FEED_CACHE_PATH)) {
          feedPayload = fs.readFileSync(FEED_CACHE_PATH, "utf8");
          console.warn(
            `Using cached Medium feed from ${path.relative(process.cwd(), FEED_CACHE_PATH)} because live fetch failed.`,
          );
        } else {
          throw new Error(
            `Failed to fetch Medium feed or proxy feed: ${error instanceof Error ? error.message : String(error)}${curlError instanceof Error ? `; proxy curl fallback: ${curlError.message}` : ""}`,
          );
        }
      }
    }
  }

  fs.writeFileSync(FEED_CACHE_PATH, feedPayload, "utf8");
  const posts = feedPayload.trim().startsWith("{") ? parseRss2Json(feedPayload) : parseFeed(feedPayload);

  for (const post of posts) {
    const cleanedHtml = normalizeArticleHtml(post.contentHtml, post.canonicalUrl);
    const sourceMap = await downloadImages(post.slug, cleanedHtml);
    const localHtml = escapeMdxTextHazards(
      normalizeVoidTagsForMdx(rewriteImageSources(cleanedHtml, sourceMap)),
    );
    const mdx = buildMdx(post, localHtml);
    const outputPath = path.join(CONTENT_DIR, `${post.slug}.mdx`);

    fs.writeFileSync(outputPath, mdx, "utf8");
    console.log(`Imported ${post.slug}`);
  }

  console.log(`Imported ${posts.length} Medium posts into ${path.relative(process.cwd(), CONTENT_DIR)}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
