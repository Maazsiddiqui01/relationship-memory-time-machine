# Relationship Memory Time Machine

This project turns a WhatsApp text export into:

1. a curated static website with story, dashboard, timeline, themes, moments, patterns, chapters, and lens pages
2. a visual e-book exported as HTML and PDF

## Source Of Truth

- Architecture and system rules: `GEMINI.md`
- Repeatable operator workflow: `DIRECTIVES.md`
- Environment template: `.env.example`

## Next-Run Workflow

When you want to run this on a different WhatsApp export:

1. Put the new `.txt` export in `data/raw/`
2. Copy `.env.example` to `.env` and update names/title if needed
3. Install dependencies
4. Run the pipeline
5. Build the website
6. Build the e-book
7. Verify outputs
8. Deploy

## Quickstart

```bash
npm install
npm run project:all
```

That full command will:

1. parse the transcript
2. analyze and consolidate narrative structure
3. curate outputs
4. publish `data/public`
5. build the Next.js site
6. build the e-book HTML
7. export the PDF

## Key Commands

```bash
npm run pipeline:parse
npm run pipeline:analyze
npm run pipeline:consolidate
npm run pipeline:curate
npm run pipeline:publish
```

```bash
npm run project:website
npm run project:ebook
npm run project:all
```

## Personalization

Use these environment variables to adapt the site and e-book to a different conversation archive or gift recipient:

- `RELATIONSHIP_MEMORY_SOURCE`
- `RELATIONSHIP_MEMORY_PRESENTATION_MODE`
- `RELATIONSHIP_MEMORY_PRIMARY_READER`
- `RELATIONSHIP_MEMORY_GIFT_FROM`
- `RELATIONSHIP_MEMORY_BOOK_TITLE`
- `RELATIONSHIP_MEMORY_BOOK_SUBTITLE`
- `RELATIONSHIP_MEMORY_BOOK_TAGLINE`

`RELATIONSHIP_MEMORY_PRESENTATION_MODE` supports:

- `gift`: direct, personal wording
- `archive`: neutral wording for non-romantic or non-gift conversation histories

If `RELATIONSHIP_MEMORY_SOURCE` is not set, the pipeline prefers the newest `.txt` file in `data/raw/`.

## Key Directories

- `pipeline/exec`: deterministic parsing and publishing
- `pipeline/orchestration`: analysis, consolidation, curation, and pipeline runner
- `data/canonical`: immutable parsed corpus
- `data/annotations`: message and segment annotations
- `data/derived`: intermediate narrative structures
- `data/public`: static frontend datasets
- `src/app`: Next.js pages
- `scripts`: ebook generation and PDF rendering

## Published Website Datasets

The static frontend reads from `data/public`, including:

- `curated_homepage.json`
- `dashboard_insights.json`
- `story_lenses.json`
- `chapter_segments.json`
- `milestones.json`
- `highlights.json`
- `topic_clusters.json`
- `phrase_motifs.json`
- `inside_jokes.json`
- `signature_metrics.json`
- `emotion_timeline.json`
- `message_frequency.json`
- `messages_manifest.json`

## Verification

Run:

```bash
npm run typecheck
npm test
npm run build
```

For deeper run instructions, quality gates, and phase-by-phase outputs, use `DIRECTIVES.md`.
