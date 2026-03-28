export type Media =
  | { kind: "image"; src: string; alt: string }
  | { kind: "video"; src: string; poster?: string };

export type Case = {
  id: string;
  title?: string;
  subtitle?: string;
  roles?: string;
  copy?: string;
  youtubeId?: string;
  href?: string;
  seriesId?: string;
  sourceHref?: string;
  videoOrder?: number;
  publishedAt?: string;
  vertical?: boolean;
  media: Media;
};

export { CASES } from "./cases.generated";
