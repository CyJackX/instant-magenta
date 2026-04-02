import { defineMiddleware } from "astro:middleware";
import { SITE_URL } from "../site.config.js";

const preferredSiteURL = new URL(SITE_URL);
const preferredHost = preferredSiteURL.hostname;
const apexHost = preferredHost.replace(/^www\./, "");

export const onRequest = defineMiddleware((context, next) => {
  if (preferredHost !== apexHost && context.url.hostname === apexHost) {
    const redirectURL = new URL(context.url);
    redirectURL.protocol = preferredSiteURL.protocol;
    redirectURL.hostname = preferredHost;
    redirectURL.port = preferredSiteURL.port;

    return context.redirect(redirectURL.toString(), 301);
  }

  return next();
});
