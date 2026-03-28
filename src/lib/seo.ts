import {
  SITE_AUTHOR_NAME,
  SITE_DEFAULT_OG_IMAGE,
  SITE_DESCRIPTION,
  SITE_ORGANIZATION,
  SITE_SOCIAL_PROFILES,
  SITE_TITLE,
} from "../../site.config.js";

export type JsonLd = Record<string, unknown>;

export type BreadcrumbItem = {
  name: string;
  path: string;
};

export type CollectionPageInput = {
  title: string;
  description: string;
  path: string;
};

export type BlogPostingInput = {
  title: string;
  description: string;
  path: string;
  image?: string;
  imageAlt?: string;
  publishedTime: Date;
  modifiedTime?: Date;
  tags?: string[];
};

export function toAbsoluteUrl(pathOrUrl: string, site: URL): string {
  return new URL(pathOrUrl, site).toString();
}

export function getDefaultOgImage(): string {
  return SITE_DEFAULT_OG_IMAGE;
}

export function summarizeText(value: string, maxLength = 160): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 3).trimEnd()}...`;
}

export function buildWebSiteJsonLd(site: URL): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_TITLE,
    description: SITE_DESCRIPTION,
    url: site.toString(),
  };
}

export function buildOrganizationJsonLd(site: URL): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_ORGANIZATION.name,
    url: SITE_ORGANIZATION.url,
    sameAs: SITE_SOCIAL_PROFILES,
    founder: {
      "@type": "Person",
      name: SITE_AUTHOR_NAME,
      url: site.toString(),
    },
  };
}

export function buildPersonJsonLd(site: URL): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "Person",
    name: SITE_AUTHOR_NAME,
    url: site.toString(),
    jobTitle: "Founder, Director, and Creative Technologist",
    worksFor: {
      "@type": "Organization",
      name: SITE_ORGANIZATION.name,
      url: SITE_ORGANIZATION.url,
    },
    sameAs: SITE_SOCIAL_PROFILES,
  };
}

export function buildCollectionPageJsonLd(
  site: URL,
  input: CollectionPageInput,
): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: input.title,
    description: input.description,
    url: toAbsoluteUrl(input.path, site),
  };
}

export function buildBreadcrumbJsonLd(
  site: URL,
  items: BreadcrumbItem[],
): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: toAbsoluteUrl(item.path, site),
    })),
  };
}

export function buildBlogPostingJsonLd(
  site: URL,
  input: BlogPostingInput,
): JsonLd {
  const image = input.image
    ? {
        "@type": "ImageObject",
        url: toAbsoluteUrl(input.image, site),
        caption: input.imageAlt || input.title,
      }
    : undefined;

  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: input.title,
    description: input.description,
    url: toAbsoluteUrl(input.path, site),
    datePublished: input.publishedTime.toISOString(),
    dateModified: (input.modifiedTime ?? input.publishedTime).toISOString(),
    author: {
      "@type": "Person",
      name: SITE_AUTHOR_NAME,
      url: site.toString(),
    },
    publisher: {
      "@type": "Organization",
      name: SITE_ORGANIZATION.name,
      url: SITE_ORGANIZATION.url,
    },
    image,
    keywords: input.tags?.length ? input.tags.join(", ") : undefined,
  };
}
