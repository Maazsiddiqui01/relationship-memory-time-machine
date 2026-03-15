# Relationship Memory Time Machine

This project turns a WhatsApp text export into a curated narrative website and a reusable structured dataset for later memory-book generation.

## Stack

- Next.js static frontend
- TypeScript pipeline and orchestration scripts
- NDJSON canonical storage
- JSON public datasets
- SQLite chunk cache via Node's built-in `node:sqlite`

## Pipeline

Run the full pipeline:

```bash
npm install
npm run pipeline:run
```

Then build the site:

```bash
npm run build
```

The default analysis provider is `heuristic`, which keeps the pipeline runnable locally and preserves the intended chunk/cache/orchestration shape. Set `RELATIONSHIP_MEMORY_ANALYSIS_PROVIDER=gemini` only after wiring a live Gemini provider.

## Key Directories

- `pipeline/exec`: deterministic parsing and publishing
- `pipeline/orchestration`: analysis, consolidation, curation, and pipeline runner
- `data/canonical`: immutable parsed corpus
- `data/annotations`: message and segment annotations
- `data/derived`: intermediate aggregates and story structures
- `data/public`: static frontend datasets
- `src/app`: Next.js story pages

## Published Outputs

After `npm run pipeline:run`, the static frontend reads from `data/public`, including:

- `curated_homepage.json`
- `chapter_segments.json`
- `milestones.json`
- `highlights.json`
- `topic_clusters.json`
- `phrase_motifs.json`
- `inside_jokes.json`
- `signature_metrics.json`
- monthly message shards listed by `messages_manifest.json`
