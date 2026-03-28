import fs from "node:fs";
import path from "node:path";
import {
  SITE_DESCRIPTION,
  SITE_TITLE,
  SITE_URL,
} from "../site.config.js";

const ASTRO_CONFIG_PATH = path.join(process.cwd(), "astro.config.mjs");
const INDEX_PAGE_PATH = path.join(process.cwd(), "src", "pages", "index.astro");
const ROBOTS_PATH = path.join(process.cwd(), "public", "robots.txt");
const RSS_PAGE_PATH = path.join(process.cwd(), "src", "pages", "rss.xml.js");

const errors = [];

function pushError(message) {
  errors.push(message);
}

function validateDescription(label, description) {
  if (typeof description !== "string" || !description.trim()) {
    pushError(`${label}: missing description.`);
    return;
  }

  const normalized = description.replace(/\s+/g, " ").trim();
  if (normalized.length < 50 || normalized.length > 200) {
    pushError(`${label}: description should be 50-200 characters.`);
  }

  if (/^(todo|tktk|lorem ipsum)/i.test(normalized)) {
    pushError(`${label}: description contains placeholder copy.`);
  }
}

if (SITE_URL.includes("example.com")) {
  pushError(`site.config.js: SITE_URL must not use example.com.`);
}

if (typeof SITE_TITLE !== "string" || !SITE_TITLE.trim()) {
  pushError(`site.config.js: SITE_TITLE is required.`);
}

validateDescription("site.config.js: SITE_DESCRIPTION", SITE_DESCRIPTION);

const astroConfig = fs.readFileSync(ASTRO_CONFIG_PATH, "utf8");
if (astroConfig.includes("example.com")) {
  pushError(`astro.config.mjs: production site is still set to example.com.`);
}

const indexPage = fs.readFileSync(INDEX_PAGE_PATH, "utf8");
if (indexPage.includes('getCollection("blog")') || indexPage.includes("getCollection('blog')")) {
  pushError(`src/pages/index.astro: homepage should not depend on blog content.`);
}

if (indexPage.includes("../images/")) {
  pushError(`src/pages/index.astro: homepage still imports deleted src/images assets.`);
}

const robots = fs.readFileSync(ROBOTS_PATH, "utf8");
if (!robots.includes(`Sitemap: ${SITE_URL}/sitemap-index.xml`)) {
  pushError(`public/robots.txt: sitemap URL must match SITE_URL.`);
}

if (fs.existsSync(RSS_PAGE_PATH)) {
  pushError(`src/pages/rss.xml.js: RSS route should be removed for the homepage-only site.`);
}

if (errors.length > 0) {
  for (const error of errors) {
    console.error(`SEO error: ${error}`);
  }
  process.exit(1);
}

console.log("SEO check passed for homepage-only site.");
