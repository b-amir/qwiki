# Wiki Aggregation Documentation

Phase 3 introduces a full wiki aggregation stack that stores, merges, and surfaces documentation across a project. This document explains each service, how they interact, and how to extend them responsibly.

## Storage and Indexing

`WikiStorageService` is the canonical gateway for wiki persistence.

- **WikiPage** entities contain id, title, content, tags, metadata (author, timestamps, version, status, project), and relationship definitions.
- **CRUD Operations** – `createWikiPage`, `updateWikiPage`, `deleteWikiPage`, and retrieval methods manage the lifecycle of pages.
- **Project Retrieval** – `getAllWikiPages` and `searchWikiPages` enable filtered access by project, including full-text search with metadata filters.
- **Indexing** – `getWikiIndex` returns aggregated metadata, tags, and relationships for fast navigation.

Always use the service instead of accessing storage directly so indexing and caches stay consistent.

## Aggregation Engine

`WikiAggregationService` consolidates disparate wiki sources into a unified project wiki.

- **Strategies** – Provide aggregation strategies outlining rules and merge approaches.
- **mergeWikiPages** – Resolves duplicates and unifies content according to the supplied merge strategy.
- **resolveConflicts** – Detects conflicting attributes and applies deterministic resolution or raises actionable issues.
- **generateProjectWiki** – Builds a comprehensive wiki for a project, recomputing indexes and statistics.
- **updateAggregation** – Refreshes aggregation incrementally when new pages arrive.

Aggregation results include statistics, issues, and a fully structured wiki object ready for presentation.

## Linking and Relationships

`WikiLinkingService` manages cross-page relationships.

- **Link Management** – Create and delete links with types and strength metadata.
- **Analysis** – `analyzeLinks` produces clusters, orphans, and hubs to highlight documentation gaps.
- **Suggestion Engine** – `suggestLinks` and `generateCrossReferences` propose relationships based on tags, content, or usage patterns.
- **Related Pages** – `getRelatedPages` surfaces contextually relevant pages for consumers.

Use linking to keep documentation navigable and highlight dependencies between modules.

## Project Index Service

`ProjectWikiIndexService` builds searchable indexes per project.

- **buildIndex** – Generates a comprehensive index with page listings, categories, tags, and structural metadata.
- **updateIndex** – Refreshes the index incrementally when pages change.
- **searchIndex** – Supports faceted search across index entries.
- **Statistics** – `getIndexStatistics` tracks total pages, category coverage, and tag usage.
- **Navigation Data** – `getCategoriesForProject` and `getTagsForProject` provide ready-to-use filter options.

Ensure indexes are refreshed after significant content edits to keep discovery in sync.

## Search and Discovery

`WikiSearchService` delivers interactive discovery features.

- **SearchQuery** – Supports text, filters, sorting, and limits.
- **fullTextSearch** – Executes relevance-ranked searches across content.
- **filterPages** – Applies structured filters (tag, status, author) before ranking.
- **Suggestions** – `getSuggestions` powers autocomplete experiences.
- **Related Pages** – Offers quick links to contextually similar documentation.

Leverage search in UI surfaces to help developers quickly locate relevant information.

## Versioning and History

`WikiVersioningService` maintains historical records.

- **Version Creation** – `createVersion` captures content snapshots with changelog notes.
- **Retrieval** – `getVersions` and `getVersion` expose version history for auditing.
- **Comparison** – `compareVersions` generates structured diffs (additions, deletions, modifications).
- **Revert** – `revertToVersion` allows rolling back to known good states.
- **History** – `getVersionHistory` aggregates chronological changes.

Use versioning to enforce accountability and enable quick recovery from regressions.

## Implementation Guidelines

- Route all wiki-related operations through these services to keep caches and indexes coherent.
- Keep aggregation strategies declarative; avoid embedding business logic in rendering layers.
- Pair wiki operations with appropriate events so webviews and extension commands receive updates.
- Monitor aggregation statistics to identify under-documented areas and prioritize content creation.
