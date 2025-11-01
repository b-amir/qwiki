import type { SavedWiki } from "../WikiStorageService";
import type {
  OptimizedStructure,
  StructureSection,
  HierarchyNode,
  NavigationItem,
} from "../../../domain/entities/WikiAggregation";

export class StructureOptimizer {
  async optimizeAggregationStructure(wikis: SavedWiki[]): Promise<OptimizedStructure> {
    const sections = this.groupWikisIntoSections(wikis);
    const hierarchy = this.buildHierarchy(wikis);
    const navigation = this.buildNavigation(sections);

    return {
      sections,
      hierarchy,
      navigation,
    };
  }

  private groupWikisIntoSections(wikis: SavedWiki[]): StructureSection[] {
    const sections: StructureSection[] = [];
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

  private buildHierarchy(wikis: SavedWiki[]): HierarchyNode[] {
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

  private buildNavigation(sections: StructureSection[]): NavigationItem[] {
    return sections.map((section, index) => ({
      title: section.name,
      sectionId: section.name.toLowerCase().replace(/\s+/g, "-"),
      level: 1,
      order: index,
    }));
  }
}
