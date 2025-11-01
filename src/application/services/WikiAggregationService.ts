import { EventBus } from "../../events/EventBus";
import {
  LoggingService,
  createLogger,
  type Logger,
} from "../../infrastructure/services/LoggingService";
import { WikiStorageService, type SavedWiki } from "./WikiStorageService";
import { ConflictResolutionHelper } from "./aggregation/ConflictResolutionHelper";
import { StructureOptimizer } from "./aggregation/StructureOptimizer";
import type {
  WikiAggregation,
  AggregationConfig,
  WikiRelationship,
  CrossReferenceMap,
  ConflictResolutionStrategy,
  OptimizedStructure,
  AggregationChanges,
  MergeStrategy,
  RelationshipType,
} from "../../domain/entities/WikiAggregation";

export class WikiAggregationService {
  private logger: Logger;
  private aggregations: Map<string, WikiAggregation> = new Map();
  private conflictHelper: ConflictResolutionHelper;
  private structureOptimizer: StructureOptimizer;

  constructor(
    private wikiStorageService: WikiStorageService,
    private loggingService: LoggingService,
    private eventBus?: EventBus,
  ) {
    this.logger = createLogger("WikiAggregationService", loggingService);
    this.conflictHelper = new ConflictResolutionHelper();
    this.structureOptimizer = new StructureOptimizer();
  }

  async createAggregation(wikiIds: string[], config: AggregationConfig): Promise<WikiAggregation> {
    this.logger.debug(`Creating aggregation with ${wikiIds.length} wikis`);

    const allWikis = await this.wikiStorageService.getAllSavedWikis();
    const wikis = allWikis.filter((w) => wikiIds.includes(w.id));

    if (wikis.length !== wikiIds.length) {
      const foundIds = wikis.map((w) => w.id);
      const missingIds = wikiIds.filter((id) => !foundIds.includes(id));
      this.logger.warn(`Some wikis not found: ${missingIds.join(", ")}`);
    }

    const relationships = await this.analyzeWikiRelationships(wikis);
    const metadata = {
      totalWikis: wikis.length,
      totalSize: wikis.reduce((sum, w) => sum + w.content.length, 0),
      languages: this.extractLanguages(wikis),
      tags: this.extractAllTags(wikis),
      relationships,
    };

    const aggregation: WikiAggregation = {
      id: this.generateAggregationId(),
      title: this.generateAggregationTitle(wikis),
      wikis,
      metadata,
      createdAt: new Date(),
    };

    this.aggregations.set(aggregation.id, aggregation);

    if (this.eventBus) {
      this.eventBus.publish("wiki-aggregation-created", {
        aggregationId: aggregation.id,
        wikiCount: wikis.length,
      });
    }

    return aggregation;
  }

  async analyzeWikiRelationships(wikis: SavedWiki[]): Promise<WikiRelationship[]> {
    const relationships: WikiRelationship[] = [];

    for (let i = 0; i < wikis.length; i++) {
      for (let j = i + 1; j < wikis.length; j++) {
        const source = wikis[i];
        const target = wikis[j];

        const relationship = this.detectRelationship(source, target);
        if (relationship) {
          relationships.push(relationship);
        }

        const reverseRelationship = this.detectRelationship(target, source);
        if (reverseRelationship) {
          relationships.push(reverseRelationship);
        }
      }
    }

    return relationships;
  }

  async generateAggregatedContent(aggregation: WikiAggregation): Promise<string> {
    const mergedContent = await this.mergeWikiContents(aggregation.wikis, "sequential");
    const toc = await this.generateTableOfContents(aggregation);
    const crossRefs = await this.createCrossReferences(aggregation.wikis);

    const sections: string[] = [];

    sections.push(`# ${aggregation.title}\n`);
    sections.push(toc);
    sections.push(mergedContent);

    if (Object.keys(crossRefs).length > 0) {
      sections.push(this.formatCrossReferences(crossRefs));
    }

    return sections.join("\n\n");
  }

  async mergeWikiContents(wikis: SavedWiki[], strategy: MergeStrategy): Promise<string> {
    const sortedWikis = this.sortWikisByStrategy(wikis, strategy);

    const sections: string[] = [];

    for (const wiki of sortedWikis) {
      sections.push(`## ${wiki.title}\n\n${wiki.content}`);
    }

    return sections.join("\n\n---\n\n");
  }

  async generateTableOfContents(aggregation: WikiAggregation): Promise<string> {
    const items: string[] = [];

    for (const wiki of aggregation.wikis) {
      const anchor = this.createAnchor(wiki.title);
      items.push(`- [${wiki.title}](#${anchor})`);
    }

    return `## Table of Contents\n\n${items.join("\n")}`;
  }

  async createCrossReferences(wikis: SavedWiki[]): Promise<CrossReferenceMap> {
    const crossRefs: CrossReferenceMap = {};

    for (const wiki of wikis) {
      crossRefs[wiki.id] = [];

      for (const otherWiki of wikis) {
        if (wiki.id === otherWiki.id) continue;

        const relationship = this.detectRelationship(wiki, otherWiki);
        if (relationship) {
          crossRefs[wiki.id].push({
            targetWikiId: otherWiki.id,
            targetTitle: otherWiki.title,
            relationshipType: relationship.relationshipType,
            location: "content",
          });
        }
      }
    }

    return crossRefs;
  }

  async updateAggregation(
    aggregationId: string,
    changes: AggregationChanges,
  ): Promise<WikiAggregation> {
    const aggregation = this.aggregations.get(aggregationId);
    if (!aggregation) {
      throw new Error(`Aggregation ${aggregationId} not found`);
    }

    let updatedWikis = [...aggregation.wikis];

    if (changes.addedWikis) {
      const allWikis = await this.wikiStorageService.getAllSavedWikis();
      const newWikis = allWikis.filter((w) => changes.addedWikis!.includes(w.id));
      updatedWikis.push(...newWikis);
    }

    if (changes.removedWikis) {
      updatedWikis = updatedWikis.filter((w) => !changes.removedWikis!.includes(w.id));
    }

    const relationships = await this.analyzeWikiRelationships(updatedWikis);
    const metadata = {
      ...aggregation.metadata,
      totalWikis: updatedWikis.length,
      totalSize: updatedWikis.reduce((sum, w) => sum + w.content.length, 0),
      languages: this.extractLanguages(updatedWikis),
      tags: this.extractAllTags(updatedWikis),
      relationships,
    };

    const updated: WikiAggregation = {
      ...aggregation,
      wikis: updatedWikis,
      metadata,
      title: changes.title || aggregation.title,
      updatedAt: new Date(),
    };

    this.aggregations.set(aggregationId, updated);

    if (this.eventBus) {
      this.eventBus.publish("wiki-aggregation-updated", {
        aggregationId,
        changes,
      });
    }

    return updated;
  }

  private async detectContentConflicts(wikis: SavedWiki[]) {
    return this.conflictHelper.detectContentConflicts(wikis);
  }

  private async resolveConflicts(conflicts: any[], strategy: ConflictResolutionStrategy) {
    return this.conflictHelper.resolveConflicts(conflicts, strategy);
  }

  private async optimizeAggregationStructure(wikis: SavedWiki[]): Promise<OptimizedStructure> {
    return this.structureOptimizer.optimizeAggregationStructure(wikis);
  }

  private detectRelationship(source: SavedWiki, target: SavedWiki): WikiRelationship | null {
    const sourceContent = source.content.toLowerCase();
    const targetTitle = target.title.toLowerCase();
    const targetPath = target.filePath?.toLowerCase() || "";

    let relationshipType: RelationshipType | null = null;
    let strength = 0;

    if (sourceContent.includes(targetTitle) || sourceContent.includes(targetPath)) {
      relationshipType = "references";
      strength = 0.7;
    }

    if (
      sourceContent.includes(`import.*${targetTitle}`) ||
      sourceContent.includes(`from.*${targetPath}`)
    ) {
      relationshipType = "imports";
      strength = 0.9;
    }

    if (
      sourceContent.includes(`extends.*${targetTitle}`) ||
      sourceContent.includes(`class.*extends.*${targetTitle}`)
    ) {
      relationshipType = "extends";
      strength = 0.95;
    }

    if (sourceContent.includes(`implements.*${targetTitle}`)) {
      relationshipType = "implements";
      strength = 0.95;
    }

    if (relationshipType) {
      return {
        sourceWiki: source.id,
        targetWiki: target.id,
        relationshipType,
        strength,
      };
    }

    return null;
  }

  private sortWikisByStrategy(wikis: SavedWiki[], strategy: MergeStrategy): SavedWiki[] {
    const sorted = [...wikis];

    switch (strategy) {
      case "chronological":
        return sorted.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      case "alphabetical":
        return sorted.sort((a, b) => a.title.localeCompare(b.title));
      case "categorical":
        return sorted.sort((a, b) => {
          const catA = a.tags[0] || "";
          const catB = b.tags[0] || "";
          return catA.localeCompare(catB);
        });
      case "sequential":
      case "custom":
      default:
        return sorted;
    }
  }

  private groupWikisIntoSections(wikis: SavedWiki[]) {
    const sections: Array<{ name: string; wikis: string[]; order: number }> = [];
    const tagMap = new Map<string, string[]>();

    for (const wiki of wikis) {
      const primaryTag = wiki.tags[0] || "General";
      if (!tagMap.has(primaryTag)) {
        tagMap.set(primaryTag, []);
      }
      tagMap.get(primaryTag)!.push(wiki.id);
    }

    let order = 0;
    for (const [tag, wikiIds] of tagMap.entries()) {
      sections.push({
        name: tag,
        wikis: wikiIds,
        order: order++,
      });
    }

    return sections;
  }

  private buildHierarchy(wikis: SavedWiki[]) {
    const relationships = wikis.reduce(
      (acc, wiki) => {
        acc[wiki.id] = [];
        return acc;
      },
      {} as Record<string, string[]>,
    );

    return Object.entries(relationships).map(([id, children]) => ({
      id,
      title: wikis.find((w) => w.id === id)?.title || "",
      level: 0,
      children: children.map((childId) => ({
        id: childId,
        title: wikis.find((w) => w.id === childId)?.title || "",
        level: 1,
        children: [],
        wikiIds: [childId],
      })),
      wikiIds: [id],
    }));
  }

  private buildNavigation(sections: Array<{ name: string; wikis: string[]; order: number }>) {
    return sections.map((section, index) => ({
      title: section.name,
      sectionId: section.name.toLowerCase().replace(/\s+/g, "-"),
      level: 1,
      order: index,
    }));
  }

  private extractLanguages(wikis: SavedWiki[]): string[] {
    const languages = new Set<string>();
    for (const wiki of wikis) {
      const langMatch = wiki.content.match(/```(\w+)/);
      if (langMatch) {
        languages.add(langMatch[1]);
      }
    }
    return Array.from(languages);
  }

  private extractAllTags(wikis: SavedWiki[]): string[] {
    const tags = new Set<string>();
    for (const wiki of wikis) {
      for (const tag of wiki.tags) {
        tags.add(tag);
      }
    }
    return Array.from(tags);
  }

  private generateAggregationId(): string {
    return `agg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  private generateAggregationTitle(wikis: SavedWiki[]): string {
    if (wikis.length === 0) return "Empty Aggregation";
    if (wikis.length === 1) return `${wikis[0].title} - Aggregation`;
    return `Aggregation of ${wikis.length} Wikis`;
  }

  private createAnchor(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-");
  }

  private formatCrossReferences(crossRefs: CrossReferenceMap): string {
    const sections: string[] = ["## Cross References\n"];

    for (const [wikiId, refs] of Object.entries(crossRefs)) {
      if (refs.length > 0) {
        sections.push(`### ${wikiId}\n`);
        for (const ref of refs) {
          sections.push(`- [${ref.targetTitle}] (${ref.relationshipType})`);
        }
      }
    }

    return sections.join("\n");
  }

  getAllAggregations(): WikiAggregation[] {
    return Array.from(this.aggregations.values());
  }
}
