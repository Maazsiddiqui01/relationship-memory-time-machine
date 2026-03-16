# Relationship Memory Time Machine Directives

This file is the operator runbook for rerunning the full system on a different WhatsApp export.

## Goal

Given a new WhatsApp text export, the system should:

1. Parse the archive into immutable canonical records.
2. Analyze and consolidate narrative structure.
3. Curate story-facing outputs.
4. Publish static datasets for the website.
5. Build the dashboard-rich website.
6. Build the visual ebook HTML and PDF.

The intended next-run workflow is: upload a different `.txt` export, set profile variables if needed, run the phased commands, verify outputs, deploy.

## Input Contract

- Primary input: one WhatsApp text export `.txt` file.
- Preferred location: `data/raw/`.
- Fallback location: repo root.
- If `RELATIONSHIP_MEMORY_SOURCE` is set, it wins.
- If it is not set, the pipeline prefers the newest `.txt` file in `data/raw/`, then the newest `.txt` file in the repo root.

## Profile Contract

These variables control gift/personalization copy:

- `RELATIONSHIP_MEMORY_PRIMARY_READER`
- `RELATIONSHIP_MEMORY_GIFT_FROM`
- `RELATIONSHIP_MEMORY_BOOK_TITLE`
- `RELATIONSHIP_MEMORY_BOOK_SUBTITLE`
- `RELATIONSHIP_MEMORY_BOOK_TAGLINE`

Use `.env.example` as the template.

## Execution Phases

### Phase 0: Prepare

1. Put the new export in `data/raw/` or set `RELATIONSHIP_MEMORY_SOURCE`.
2. Copy `.env.example` to a local `.env` and adjust names/title if this is a gift build.
3. Run `npm install` if dependencies changed.

### Phase 1: Parse

Command:

```bash
npm run pipeline:parse
```

Outputs:

- `data/canonical/messages.ndjson`
- `data/canonical/participants.json`
- `data/canonical/source_manifest.json`

### Phase 2: Analyze

Command:

```bash
npm run pipeline:analyze
```

Outputs:

- `data/annotations/message_annotations.ndjson`
- `data/annotations/chunk_annotations.ndjson`
- `data/annotations/segment_annotations.ndjson`

### Phase 3: Consolidate

Command:

```bash
npm run pipeline:consolidate
```

Outputs include:

- `data/derived/narrative_segments.json`
- `data/derived/chapter_segments.json`
- `data/derived/milestones.json`
- `data/derived/highlights.json`
- `data/derived/topic_clusters.json`
- `data/derived/phrase_motifs.json`
- `data/derived/inside_jokes.json`
- `data/derived/emotion_timeline.json`
- `data/derived/message_frequency.json`
- `data/derived/signature_metrics.json`
- `data/derived/dashboard_insights.json`

### Phase 4: Curate

Command:

```bash
npm run pipeline:curate
```

Outputs include:

- `data/derived/curated_homepage.json`
- refined milestones/highlights/chapter summaries
- story-facing prioritization for homepage, dashboard, and chapter routes

### Phase 5: Publish

Command:

```bash
npm run pipeline:publish
```

Outputs:

- `data/public/*.json`
- `data/public/messages/*.json`
- `data/public/messages_manifest.json`
- `data/public/story_lenses.json`

### Phase 6: Website Build

Command:

```bash
npm run project:website
```

This runs the full pipeline and then builds the static Next.js site.

Primary routes:

- `/`
- `/dashboard`
- `/timeline`
- `/moments`
- `/themes`
- `/patterns`
- `/lenses/[slug]`
- `/chapters/[slug]`

### Phase 7: Ebook Build

Commands:

```bash
npm run ebook:build
npm run ebook:pdf
```

Or:

```bash
npm run project:ebook
```

Outputs:

- `output/pdf/*.html`
- `output/pdf/*.json`
- `output/pdf/*.pdf`

### Phase 8: Full End-to-End Run

Command:

```bash
npm run project:all
```

This is the reusable “do everything” path once the new export and profile variables are in place.

## Verification Gates

Run:

```bash
npm run typecheck
npm test
npm run build
```

Check:

1. `data/public` contains the expected published datasets.
2. `/dashboard` renders chart data correctly.
3. `/chapters/[slug]` and `/lenses/[slug]` build without local-only dependencies.
4. The ebook HTML renders cleanly before PDF export.
5. Personalized copy uses the configured reader/giver names.

## Deployment Notes

- Vercel builds from the checked-in `data/public` datasets.
- The website must not depend on `data/annotations/*.ndjson` at build time.
- If Vercel fails, verify the latest Git commit contains the current `data/public` artifacts.

## Quality Rules

- Canonical data is immutable.
- Narrative claims must be evidence-grounded.
- Website remains visual-first and not transcript-heavy.
- Dashboard remains deterministic and precomputed.
- Ebook remains visual-first with restrained text and no overflow/cropping.

## Current Source of Truth

- Architecture and system rules: `GEMINI.md`
- Reusable operator workflow: `DIRECTIVES.md`
- Quickstart and project overview: `README.md`
