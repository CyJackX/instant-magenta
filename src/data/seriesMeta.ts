export type SeriesMeta = {
  title: string;
  copy?: string;
  homeSectionId?: string;
};

export const SERIES_META: Record<string, SeriesMeta> = {
  "andys-originals": {
    title: "Andy's Originals",
    homeSectionId: "scripted-digital-series",
  },
  "apocalypse-problems": {
    title: "Apocalypse Problems",
    copy: "A comedic webseries for SpoiledNYC.",
    homeSectionId: "scripted-digital-series",
  },
  "asian-afterlife": {
    title: "Andy's Asian Afterlife",
    copy: "Grand prize winner of Rizzle's Asian Comedy Fest.",
    homeSectionId: "scripted-digital-series",
  },
  "branded-content": {
    title: "Branded Content",
    homeSectionId: "branded-content",
  },
  "comedy-central-originals": {
    title: "Comedy Central Originals",
    copy:
      "At Comedy Central's Webby-winning Digital team, Andy directed and produced multiple series, music videos, and other collaborations with notable influencers like Anwar, Adam Waheed, Sven Johnson, Rose Kelso, & more.",
    homeSectionId: "scripted-digital-series",
  },
  "death-becomes-her": {
    title: "Death Becomes Her",
    copy: "A series of BTS social promos for Broadway's Death Becomes Her.",
    homeSectionId: "branded-content",
  },
  editing: {
    title: "Unscripted Editor",
  },
  "making-it": {
    title: "Making It",
    copy: "An original vertical series for Snapchat's Snap Originals.",
    homeSectionId: "scripted-digital-series",
  },
  "music-videos": {
    title: "Music Videos",
    homeSectionId: "music-videos",
  },
  series: {
    title: "Scripted Digital Series",
    homeSectionId: "scripted-digital-series",
  },
  shorts: {
    title: "Short Films",
    homeSectionId: "sketches-shorts",
  },
  sketch: {
    title: "Sketch Comedy",
    homeSectionId: "sketches-shorts",
  },
  tech: {
    title: "Technologist",
    copy:
      "From After Effects compositing to VR streaming, 3D engines, genAI, and more, Andy applies a wide range of technical skills to his work as a director and editor.",
    homeSectionId: "technology",
  },
  "the-honest-waitress": {
    title: "The Honest Waitress",
    copy: "A comedic webseries for PitTV.",
    homeSectionId: "scripted-digital-series",
  },
  favorites: {
    title: "Fan Favorites",
    homeSectionId: "fan-favorites",
  },
};
