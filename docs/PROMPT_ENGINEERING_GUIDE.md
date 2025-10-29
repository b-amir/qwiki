# Prompt Engineering Guide

This guide explains how Phase 3 prompt engineering features are structured and how to use them when extending Qwiki. It covers template authoring, versioning, validation, provider specialization, and dynamic adjustments so documentation remains robust across providers while staying local-first.

## Core Concepts

- **Prompt Templates** – Canonical instructions stored through `PromptTemplateService`. Each template includes metadata (category, language, provider preference, complexity), version history, and structured variables.
- **Prompt Variables** – Declarative placeholders specifying expected data: name, type, description, optional default, and required flag. Variables ensure prompts remain data-driven and reusable.
- **Prompt Versions** – Immutable snapshots created whenever important content changes. Versions track author, timestamp, and changelog entries for auditability.
- **Prompt Context** – Rich runtime payload combining code, project information, user preferences, and interaction history. Templates render against this context before sending prompts to providers.

## Template Authoring Workflow

1. **Design Metadata** – Choose category (documentation, explanation, summary, analysis, custom), language, preferred provider, and target complexity level.
2. **Define Variables** – List every external input. Provide clear descriptions so the renderer can validate context completeness.
3. **Write Content** – Use handlebars-style placeholders (`{{variableName}}`). Keep instructions concise, emphasize outcome-driven summaries, and adopt consistent tone aligned with Development Guidelines.
4. **Validate** – Call `PromptTemplateService.createTemplate` or `updateTemplate`. Validation checks variable usage, ensures required placeholders exist, and rejects unsafe patterns.
5. **Version** – On significant edits, create a new version with a descriptive changelog via `createVersion`. Versioning enables rollback and comparison.

## Provider Specialization

`ProviderPromptVariants` manages prompt adaptations:

- **Variant Creation** – `createVariant` stores provider-specific prompt text, linking to the base template.
- **Optimization Tracking** – Each variant includes optimization metadata (type, description, impact) to document why adjustments exist.
- **Model Adaptation** – `optimizeForProvider` can generate variants tuned for latency, token limits, or instruction styles.
- **Effectiveness Monitoring** – Retrieval APIs expose variant performance so teams can refine strategies per provider.

## Validation and Quality Scoring

`PromptValidationService` enforces prompt quality:

- `validatePrompt` checks syntax, variable usage, and structural requirements.
- `scorePromptQuality` computes clarity, specificity, completeness, and consistency metrics.
- `suggestImprovements` highlights actionable changes before prompts reach providers.
- `comparePrompts` supports A/B testing by contrasting two templates or versions.

Always run validation before publishing new prompts. Treat warnings as opportunities to refine tone, precision, and resilience.

## Dynamic Adjustment

`DynamicPromptAdjustmentService` allows prompts to adapt at runtime:

- **Context Analysis** – `analyzeContext` inspects project domain, language, style preferences, and complexity.
- **Adjustment Rules** – Register rules with conditions and transformations prioritized for deterministic application.
- **Runtime Rendering** – `adjustPrompt` combines the base template, provider variant, and applicable rules to produce final content per request.
- **Traceability** – `getAppliedAdjustments` reveals which rules triggered for a given context, simplifying debugging.

Keep rules small, focused, and declarative. Avoid embedding business logic inside templates—prefer separate rule modules.

## Library Management

`PromptLibraryService` organizes prompts across projects:

- **Libraries** group related templates with shared metadata (author, description, timestamps).
- **Categorization** ensures discoverability via tags and categories.
- **Search** uses metadata and content queries to locate relevant prompts quickly.
- **Import/Export** allows sharing libraries in various formats while preserving metadata and versioning.
- **Collaboration** metadata tracks contributors to support multi-author workflows.

## Best Practices

- Maintain minimal, provider-agnostic base templates; offload provider quirks to variants.
- Document every version change with meaningful changelog entries.
- Use dynamic adjustments for context-specific tweaks instead of branching templates.
- Run validation and quality scoring during CI or pre-commit steps to catch regressions early.
- Store templates in libraries that mirror product areas or documentation domains to simplify discovery.
