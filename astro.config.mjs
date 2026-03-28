// @ts-check
import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";

import cloudflare from "@astrojs/cloudflare";
import tailwindcss from "@tailwindcss/vite";
import { SITE_URL } from "./site.config.js";

// https://astro.build/config
export default defineConfig({
	site: SITE_URL,
	integrations: [
		mdx(),
		sitemap({
			filter: (page) => !page.endsWith("/about/"),
		}),
	],
	adapter: cloudflare({
		platformProxy: {
			enabled: true,
		},
	}),
	vite: {
		plugins: [tailwindcss()],
	},
});
