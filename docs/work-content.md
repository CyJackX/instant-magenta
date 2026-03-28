# Work Content Workflow

This site is data-driven from two TSV files:

- `src/data/cases.tsv`
- `src/data/series.tsv`

## Data Model

- `videos`: built from `CASES` (`src/data/cases.tsv` -> `src/data/cases.generated.ts`)
- `series`: built from `SERIES` (`src/data/series.tsv` -> `src/data/series.generated.ts`)
- Relationship: `video.seriesId -> series.id`

### Optional Case Columns

- `seriesId`
- `sourceHref`
- `show` (`true`/`false`)
- `showOnHome` (`true`/`false`)
- `homeOrder` (number)
- `videoOrder` (number, for ordering inside a series)
- `publishedAt` (ISO-compatible date string)

## Pages Generated Automatically

- Home feed (mixed videos + series): `src/pages/index.astro`
- Series pages: `src/pages/series/[slug].astro`
- Video pages: `src/pages/video/[slug].astro`

## How To Add A Video

1. Add/update a row in `src/data/cases.tsv`.
2. Run `node scripts/gen-cases.mjs`.
3. Set `seriesId` to attach the video to a series.
4. The video appears on home and in its series page automatically.

## How To Add A Series

1. Add a row in `src/data/series.tsv`.
2. Run `node scripts/gen-series.mjs`.
3. Add `seriesId` to one or more case rows in `src/data/cases.tsv`.

## Home Feed Ordering

- Series ordering: `series.homeOrder` (smaller appears first)
- Video ordering: `video.homeOrder` (falls back to current row order + `1000`)
- Home feed is a single sorted list from both sets.
