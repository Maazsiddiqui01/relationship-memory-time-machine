# GEMINI.md

# Relationship Memory Time Machine System

Directive Layer for AntiGravity

---

# 1. Purpose

This system transforms a long-form WhatsApp conversation archive into an emotionally meaningful digital memory experience.

It converts raw chronological chat logs into a structured narrative that can be explored through an interactive website and later exported into a digital memory book.

The workflow must be reusable. A future run should be able to start from a different WhatsApp export file and regenerate the same phased outputs: parsed corpus, published datasets, dashboard-driven website, and formatted e-book.

The system is not a generic analytics dashboard. It is a storytelling engine that reconstructs shared history through chapters, emotional shifts, recurring themes, memorable messages, and curated moments.

The system ultimately produces two deliverables:

1. Interactive Website Experience
2. Generated Digital Memory Book

Success means transforming raw conversation logs into a coherent, evidence-grounded memory journey that can be explored chronologically, thematically, and emotionally.

---

# 2. Success Criteria

The system is successful when it reliably produces the following outcomes.

## Data Processing

- Parse large WhatsApp text exports without errors.
- Correctly identify timestamps, senders, message bodies, and multiline continuations.
- Preserve an immutable canonical dataset.
- Generate structured JSON and NDJSON outputs for downstream use.

## Narrative Reconstruction

- Identify major relationship phases and chapters.
- Detect emotionally meaningful exchanges and turning points.
- Surface recurring themes, phrases, and inside jokes.
- Track emotional tone and conversation archetypes across time.
- Build curated story moments instead of exposing raw analysis directly.

## Visual Experience

The frontend should successfully present:

- a story-led homepage
- a detailed dashboard page
- a relationship timeline
- emotional journey views
- milestone and highlight cards
- conversation pattern views
- chapter storytelling pages
- thematic exploration sections

## Performance

The system must handle:

- hundreds of thousands of messages
- multiple years of conversation

without requiring the browser to load the full corpus at once.

## User Experience

The final experience should feel:

- warm
- immersive
- elegant
- emotionally meaningful

Storytelling should take priority over raw metrics presentation.

## Output Generation

The system must generate structured outputs suitable for:

- static website rendering
- future e-book generation
- rerunnable analysis and curation workflows

---

# 3. Inputs & Context

## Primary Input

The system receives a WhatsApp text export file.

For repeatable runs, the preferred drop location is `data/raw/`.
If `RELATIONSHIP_MEMORY_SOURCE` is not set, the pipeline should prefer the newest `.txt` file in `data/raw/`, then the newest `.txt` file in the repo root.

Expected format example:

```text
12/02/2024, 10:23 pm - You: message
12/02/2024, 10:24 pm - Her: message
```

Properties extracted from each message:

- timestamp
- sender
- message content

The export contains text messages only.
No media files are expected beyond placeholder lines such as `<Media omitted>`.

---

## Secondary Context

The system may infer higher-level relationship context such as:

- milestones
- recurring phrases
- emotional tone shifts
- activity changes
- conflict and repair sequences
- narrative chapters

These insights are generated from deterministic features plus AI-assisted interpretation.

---

## Environment Assumptions

Expected stack:

- Frontend: Next.js / React
- Visualization: Recharts or D3
- Animation: Framer Motion
- Processing: deterministic execution scripts plus Gemini analysis
- Storage: file-based outputs for v1

Supabase is optional and out of scope for v1.

It may be introduced later for:

- admin review tooling
- annotation editing
- multi-project support
- authentication
- hosted dataset access

## Project Profile Context

The system may receive build-time personalization through environment variables.

Examples:

- `RELATIONSHIP_MEMORY_PRESENTATION_MODE`
- `RELATIONSHIP_MEMORY_PRIMARY_READER`
- `RELATIONSHIP_MEMORY_GIFT_FROM`
- `RELATIONSHIP_MEMORY_BOOK_TITLE`
- `RELATIONSHIP_MEMORY_BOOK_SUBTITLE`
- `RELATIONSHIP_MEMORY_BOOK_TAGLINE`

These values affect website and e-book copy only. They must not modify canonical data.

Presentation modes should support at least:

- `gift`: direct, personal wording
- `archive`: neutral wording suitable for non-romantic or generally descriptive conversation histories

---

# 4. Layer Model

The system is explicitly divided into three layers.

## Directive Layer

This file, `GEMINI.md`, defines:

- product intent
- narrative priorities
- architecture rules
- output constraints
- safety and quality rules

## Orchestration Layer

The orchestration layer manages:

- pipeline ordering
- chunk scheduling
- cache management
- structured-output validation
- retries
- consolidation
- curation
- publishing

## Execution Layer

The execution layer contains deterministic scripts and frontend rendering code.

It is responsible for:

- parsing
- normalization
- aggregation
- sessionization
- dataset generation
- deterministic ranking rules
- static site rendering

The AI must never directly control UI rendering logic.

---

# 5. Operating Model

The operating sequence must always follow:

## Step 1 - Parse

Load and structure the raw chat file into immutable canonical records.

Extract:

- timestamp
- sender
- message
- message type

## Step 2 - Analyze

Run deterministic feature extraction plus chunk-based Gemini interpretation.

Examples:

- emotion analysis
- topic detection
- archetype detection
- importance scoring
- milestone candidate detection

## Step 3 - Consolidate

Merge chunk outputs into corpus-level narrative candidates.

Examples:

- recurring themes
- milestone candidates
- phrase motifs
- inside jokes
- chapter candidates
- narrative segment candidates

## Step 4 - Curate

Select and refine the most meaningful story-facing outputs.

The curation stage is responsible for:

- homepage highlight selection
- representative quote selection
- milestone ranking
- highlight candidate ranking
- redundancy removal
- emotional balance across surfaced content
- curated homepage payload assembly

## Step 5 - Publish

Generate optimized, visualization-ready datasets and static site assets.

The final output should be intentionally curated and narrative-first, not a direct dump of raw aggregate analysis.

## Step 6 - Build Website

Compile the static Next.js experience from published JSON datasets.

This includes:

- story homepage
- dashboard page
- timeline
- moments
- themes
- patterns
- chapter pages
- lens pages

## Step 7 - Build E-book

Generate the visual memory book HTML and PDF from published datasets plus configured artwork.

The e-book should remain visual-first, chart-first, and layout-safe.

---

# 6. Conversation Structure Model

The system must treat conversation structure at multiple levels.

## Technical Sessions

Technical sessions are deterministic windows used only for:

- chunking
- batching
- local pipeline processing
- activity metrics

They may use inactivity-gap heuristics and processing-size limits.

## Narrative Segments

Narrative segments are higher-level story units used for:

- storytelling
- chapter boundaries
- emotional phase reconstruction
- milestone grouping

They should consider:

- emotional tone changes
- topic shifts
- conflict to repair sequences
- spikes in message density
- sustained multi-message exchanges

## Chapters

Chapters are curated story groupings built from one or more narrative segments.

Chapters should feel like meaningful phases of the relationship rather than arbitrary time buckets.

---

# 7. Core Capabilities

## Chat Parsing

The system must:

- parse WhatsApp export formats
- remove or classify system messages
- normalize timestamps
- preserve multiline messages
- handle large files safely

## Emotional Analysis

Each meaningful message or exchange should receive emotional interpretation.

Example labels:

- romantic
- supportive
- funny
- neutral
- conflict
- nostalgic

The system should also compute an emotional intensity score.

## Topic Detection

Messages should be grouped into recurring conversational themes.

Examples:

- daily life
- future plans
- relationship discussions
- humor
- difficult conversations

## Conversation Archetypes

The system must classify exchanges into higher-level relational archetypes.

V1 archetypes:

- check-in
- affection
- planning
- humor_banter
- reassurance
- conflict
- repair_reconnection
- longing_missing
- everyday_life
- future_imagining

## Milestone Detection

The system should identify meaningful moments such as:

- emotional breakthroughs
- support moments
- apologies
- reconnection points
- strong affection exchanges

Each milestone must reference real message IDs.

## Relationship Chapter Generation

The system should divide the relationship into narrative chapters using:

- narrative segments
- emotional transitions
- conversation archetypes
- topic shifts
- activity changes

## Memory Highlight Selection

The system should surface meaningful quotes and exchanges based on:

- emotional intensity
- importance score
- archetype significance
- thematic importance
- curation rules

## Relationship Signature Metrics

The system must compute story-supporting summary metrics such as:

- total messages
- average daily message volume
- longest streak of daily conversation
- most active day
- most active month
- longest technical session
- average reply gap per participant
- late-night conversation percentage
- support moments count
- conflict-repair cycles
- dominant tone by chapter

These metrics support storytelling and pattern views.

## Temporal Visualization Data

Generate datasets for:

- message frequency
- emotional arc
- conversation heatmaps
- reply rhythms
- activity patterns

## Thematic and Motif Detection

Prioritize richer representations over word clouds.

Primary outputs should include:

- topic clusters
- phrase motifs
- recurring themes
- inside jokes

Word clouds may exist but must not be treated as a primary visualization.

---

# 8. Generated Data Structures

The system should produce structured datasets for both pipeline internals and frontend publishing.

Core naming conventions:

- `messages.ndjson`
- `message_annotations.ndjson`
- `segment_annotations.ndjson`
- `messages_manifest.json`
- `emotion_timeline.json`
- `message_frequency.json`
- `milestones.json`
- `chapter_segments.json`
- `narrative_segments.json`
- `topic_clusters.json`
- `phrase_motifs.json`
- `inside_jokes.json`
- `highlights.json`
- `signature_metrics.json`
- `dashboard_insights.json`
- `story_lenses.json`
- `curated_homepage.json`
- `memory_book_payload.json`

Canonical messages must remain immutable.

All annotations and insights must exist in separate derived datasets that reference `message_id`, `narrative_segment_id`, or `chapter_id`.

---

# 9. Execution Guidelines

The system must follow deterministic-first architecture.

## Deterministic Responsibilities

Deterministic scripts must handle:

- parsing
- timestamp normalization
- participant mapping
- message typing
- technical sessionization
- aggregation
- reply gap calculation
- lexical candidate extraction
- phrase motif candidate extraction
- signature metrics generation
- dataset publishing

## Gemini Responsibilities

Gemini should focus on:

- emotional interpretation
- thematic grouping
- conversation archetype labeling
- milestone detection
- narrative segmentation support
- chapter summarization
- highlight extraction
- curation support

## AI Usage Rules

If Gemini APIs are used:

- batch messages for efficiency
- never resend the full corpus repeatedly
- cache chunk outputs
- validate structured outputs
- keep outputs evidence-grounded

## Performance Rules

Large histories should be processed in stages:

1. Parse dataset
2. Build deterministic features
3. Chunk messages
4. Analyze chunks
5. Consolidate outputs
6. Curate story-facing results
7. Publish static datasets
8. Build the website
9. Build the e-book

## Repeatability Rules

The system should be runnable as a repeatable production workflow for a different relationship archive.

That means:

- published frontend datasets must be sufficient for static site generation
- the website must not depend on local-only annotation files at build time
- personalization must come from project profile configuration, not hardcoded names
- a different uploaded transcript should be processable through the same phases
- verification must occur before deployment

---

# 10. Safety Rules & Constraints

## Data Integrity

Never modify the original chat export.

Always operate on parsed copies.

## Canonical Integrity

Canonical records are immutable after creation.

AI labels, summaries, milestones, and curation outputs must never overwrite canonical fields.

## Privacy

Personal conversation data should remain local whenever possible.

If external AI is used, only transmit the minimum necessary chunked content.

## No Fabricated Insights

The system must not invent events, quotes, or milestones.

All surfaced narrative claims must be grounded in real messages.

## Verification

Milestones, highlights, chapters, motifs, and inside jokes must reference actual evidence records.

## Destructive Actions

The system must not delete source files or canonical datasets.

---

# 11. Best Practices

## Narrative First

Prioritize storytelling over analytics.

## Curated Experience

Do not expose every insight directly.

Select the most meaningful, diverse, and representative moments for presentation.

## Visualization Simplicity

Avoid dashboard-heavy interfaces.

Focus on:

- chapter storytelling
- timeline exploration
- emotional progression
- milestone moments
- recurring themes
- relationship patterns

## Chunking and Caching

Large datasets must be processed in resumable batches with cached outputs.

## Deduplication

Prevent duplicate parsing, duplicate highlights, and redundant surfaced insights.

## Static Publishing

The frontend should consume precomputed JSON datasets and lazy-load deeper data as needed.

## Reusability

The standard operating path should be:

1. upload or point to a new transcript
2. set project profile variables if needed
3. run the phased pipeline
4. build the website
5. build the e-book
6. verify outputs
7. deploy

---

# 12. Response Style

When operating within this project, responses should be structured as follows:

## 1. Diagnosis

Explain the current state, dataset situation, or implementation issue.

## 2. Plan

Describe the processing or transformation steps to be taken.

## 3. Execution Output

Provide:

- generated datasets
- pipeline outputs
- frontend structure
- implementation results

## 4. Explanation

Explain reasoning behind classifications, curation, or output design.

## 5. Improvement Suggestions

Recommend iterative quality improvements.

---

# 13. Summary

This system is a relationship memory reconstruction engine.

Its purpose is to transform raw WhatsApp conversations into an elegant, evidence-grounded narrative experience that can be explored through a static web interface and later preserved as a digital memory book.

The system must remain deterministic-first, narrative-first, and curation-aware.

It acts as a historian, interpreter, publisher, and reusable production workflow for shared history rather than a generic analytics tool.
