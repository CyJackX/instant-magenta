import fs from "node:fs";
import path from "node:path";
import { SITE_URL } from "../site.config.js";

const BLOG_DIR = path.join(process.cwd(), "src", "content", "blog");
const ASTRO_CONFIG_PATH = path.join(process.cwd(), "astro.config.mjs");

const errors = [];
const warnings = [];
const seenTitles = new Map();

function pushError(message) {
  errors.push(message);
}

function pushWarning(message) {
  warnings.push(message);
}

function parseFrontmatter(content, filePath) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) {
    pushError(`${filePath}: missing frontmatter.`);
    return {};
  }

  const data = {};

  for (const line of match[1].split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf(":");
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();

    try {
      data[key] = JSON.parse(rawValue);
    } catch {
      data[key] = rawValue;
    }
  }

  return data;
}

function validateDescription(filePath, description) {
  if (typeof description !== "string" || !description.trim()) {
    pushError(`${filePath}: missing description.`);
    return;
  }

  const normalized = description.replace(/\s+/g, " ").trim();
  if (normalized.length < 50 || normalized.length > 200) {
    pushError(`${filePath}: description should be 50-200 characters.`);
  }

  if (/^(todo|tktk|lorem ipsum)/i.test(normalized)) {
    pushError(`${filePath}: description contains placeholder copy.`);
  }
}

function validateBlogFile(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  const relativePath = path.relative(process.cwd(), filePath);
  const frontmatter = parseFrontmatter(content, relativePath);
  const title =
    typeof frontmatter.title === "string" ? frontmatter.title.trim() : "";

  if (!title) {
    pushError(`${relativePath}: missing title.`);
  } else {
    const duplicate = seenTitles.get(title);
    if (duplicate) {
      pushError(`${relativePath}: duplicate title also used in ${duplicate}.`);
    } else {
      seenTitles.set(title, relativePath);
    }
  }

  validateDescription(relativePath, frontmatter.description);

  if (
    typeof frontmatter.heroImage !== "string" ||
    !frontmatter.heroImage.trim()
  ) {
    pushError(`${relativePath}: missing heroImage.`);
  }

  if (
    typeof frontmatter.heroImageAlt !== "string" ||
    frontmatter.heroImageAlt.trim().length < 8
  ) {
    pushError(`${relativePath}: missing heroImageAlt.`);
  }

  if ((content.match(/<img\b[^>]*\balt=""[^>]*>/g) ?? []).length > 0) {
    pushWarning(`${relativePath}: contains inline images with empty alt text.`);
  }
}

if (SITE_URL.includes("example.com")) {
  pushError(`site.config.js: SITE_URL must not use example.com.`);
}

const astroConfig = fs.readFileSync(ASTRO_CONFIG_PATH, "utf8");
if (astroConfig.includes("example.com")) {
  pushError(`astro.config.mjs: production site is still set to example.com.`);
}

for (const entry of fs.readdirSync(BLOG_DIR)) {
  if (!/\.(md|mdx)$/i.test(entry)) {
    continue;
  }

  validateBlogFile(path.join(BLOG_DIR, entry));
}

for (const warning of warnings) {
  console.warn(`SEO warning: ${warning}`);
}

if (errors.length > 0) {
  for (const error of errors) {
    console.error(`SEO error: ${error}`);
  }
  process.exit(1);
}

console.log(`SEO check passed for ${seenTitles.size} blog posts.`);
