import { EventEmitter } from 'events'
import type {
  WikiPage,
  WikiIndex
} from '../types/WikiTypes'
import type {
  AggregationStrategy,
  AggregatedWiki,
  AggregationResult,
  AggregationStatistics,
  AggregationIssue,
  AggregationWarning,
  WikiStructure,
  WikiHierarchyNode,
  WikiCategory,
  WikiRelationshipMap,
  AggregatedWikiMetadata,
  ConflictResolution,
  DuplicateDetectionResult,
  DuplicateGroup
} from '../types/AggregationTypes'
import {
  MergeStrategy,
  ConflictResolutionStrategy,
  ConflictType,
  DuplicateType,
  SuggestedAction,
  IssueType,
  IssueSeverity,
  AggregationType,
  WarningType
} from '../types/AggregationTypes'

export class WikiAggregationService extends EventEmitter {
  private aggregatedWikis: Map<string, AggregatedWiki> = new Map()
  private strategies: Map<string, AggregationStrategy> = new Map()
  private conflictResolutions: Map<string, ConflictResolution[]> = new Map()

  constructor() {
    super()
    this.initializeDefaultStrategies()
  }

  async aggregateWikis(projectId: string, strategy: AggregationStrategy): Promise<AggregationResult> {
    const startTime = Date.now()
    const pages = await this.getProjectPages(projectId)

    try {
      const duplicateDetection = await this.detectDuplicates(pages)
      const conflicts = await this.detectConflicts(pages)
      const mergedPages = await this.mergeWikiPages(pages, strategy.mergeStrategy)
      const structure = await this.buildWikiStructure(mergedPages, strategy)
      const index = await this.buildAggregatedIndex(mergedPages)

      const aggregatedWiki: AggregatedWiki = {
        id: this.generateId(),
        projectId,
        name: `${projectId} - Aggregated Wiki`,
        pages: mergedPages,
        structure,
        index,
        metadata: {
          version: '1.0.0',
          strategy: strategy.id,
          createdBy: 'system',
          tags: this.extractCommonTags(mergedPages),
          lastModified: new Date(),
          statistics: this.calculateStatistics(mergedPages, duplicateDetection, conflicts)
        },
        createdAt: new Date(),
        updatedAt: new Date()
      }

      this.aggregatedWikis.set(aggregatedWiki.id, aggregatedWiki)

      const issues = await this.validateAggregatedWiki(aggregatedWiki)
      const warnings = this.generateWarnings(aggregatedWiki, duplicateDetection)

      const result: AggregationResult = {
        success: true,
        wiki: aggregatedWiki,
        statistics: aggregatedWiki.metadata.statistics,
        issues,
        warnings,
        duration: Date.now() - startTime
      }

      this.emit('aggregationCompleted', result)
      return result

    } catch (error) {
      const result: AggregationResult = {
        success: false,
        wiki: null,
        statistics: {
          totalPages: 0,
          totalCategories: 0,
          totalTags: 0,
          duplicatesFound: 0,
          conflictsResolved: 0,
          pagesMerged: 0,
          pagesAdded: 0,
          pagesRemoved: 0
        },
        issues: [{
          type: IssueType.BROKEN_REFERENCES,
          severity: IssueSeverity.CRITICAL,
          message: `Aggregation failed: ${error}`,
          suggestedAction: 'Review aggregation strategy and input pages'
        }],
        warnings: [],
        duration: Date.now() - startTime
      }

      this.emit('aggregationFailed', result)
      return result
    }
  }

  async mergeWikiPages(pages: WikiPage[], strategy: MergeStrategy): Promise<WikiPage[]> {
    const duplicateDetection = await this.detectDuplicates(pages)
    const mergedPages: WikiPage[] = []
    const processedIds = new Set<string>()

    for (const duplicateGroup of duplicateDetection.duplicates) {
      if (duplicateGroup.pageIds.length === 1) {
        const page = pages.find(p => p.id === duplicateGroup.pageIds[0])
        if (page && !processedIds.has(page.id)) {
          mergedPages.push(page)
          processedIds.add(page.id)
        }
      } else {
        const duplicatePages = pages.filter(p => duplicateGroup.pageIds.includes(p.id))
        const mergedPage = await this.mergeDuplicatePages(duplicatePages, strategy)
        if (mergedPage && !processedIds.has(mergedPage.id)) {
          mergedPages.push(mergedPage)
          duplicateGroup.pageIds.forEach(id => processedIds.add(id))
        }
      }
    }

    for (const page of pages) {
      if (!processedIds.has(page.id)) {
        mergedPages.push(page)
      }
    }

    return mergedPages
  }

  async resolveConflicts(pages: WikiPage[], strategy: ConflictResolutionStrategy): Promise<WikiPage[]> {
    const conflicts = await this.detectConflicts(pages)
    const resolvedPages = [...pages]
    const resolutions: ConflictResolution[] = []

    for (const conflict of conflicts) {
      const resolution = await this.resolveConflict(conflict, strategy)
      if (resolution) {
        resolutions.push(resolution)
        await this.applyResolution(resolvedPages, resolution)
      }
    }

    const projectId = pages[0]?.metadata.projectId || 'unknown'
    if (!this.conflictResolutions.has(projectId)) {
      this.conflictResolutions.set(projectId, [])
    }
    this.conflictResolutions.get(projectId)!.push(...resolutions)

    return resolvedPages
  }

  async generateProjectWiki(projectId: string): Promise<AggregatedWiki> {
    const strategy = this.getDefaultStrategy()
    const result = await this.aggregateWikis(projectId, strategy)

    if (!result.success || !result.wiki) {
      throw new Error(`Failed to generate project wiki: ${result.issues[0]?.message}`)
    }

    return result.wiki
  }

  async updateAggregation(projectId: string): Promise<void> {
    const existingAggregations = Array.from(this.aggregatedWikis.values())
      .filter(wiki => wiki.projectId === projectId)

    for (const aggregation of existingAggregations) {
      const strategy = this.strategies.get(aggregation.metadata.strategy)
      if (strategy) {
        const result = await this.aggregateWikis(projectId, strategy)
        if (result.success && result.wiki) {
          this.aggregatedWikis.delete(aggregation.id)
          this.aggregatedWikis.set(result.wiki.id, result.wiki)
        }
      }
    }
  }

  private async detectDuplicates(pages: WikiPage[]): Promise<DuplicateDetectionResult> {
    const startTime = Date.now()
    const duplicateGroups: DuplicateGroup[] = []
    const processed = new Set<string>()

    for (let i = 0; i < pages.length; i++) {
      if (processed.has(pages[i].id)) continue

      const duplicates: string[] = [pages[i].id]

      for (let j = i + 1; j < pages.length; j++) {
        if (processed.has(pages[j].id)) continue

        const similarity = this.calculateSimilarity(pages[i], pages[j])
        if (similarity > 0.8) {
          duplicates.push(pages[j].id)
          processed.add(pages[j].id)
        }
      }

      if (duplicates.length > 1) {
        const avgSimilarity = duplicates.length > 2
          ? this.calculateGroupSimilarity(duplicates.map(id => pages.find(p => p.id === id)!))
          : this.calculateSimilarity(pages[i], pages.find(p => p.id === duplicates[1])!)

        duplicateGroups.push({
          id: this.generateId(),
          pageIds: duplicates,
          similarity: avgSimilarity,
          duplicateType: this.classifyDuplicateType(avgSimilarity),
          suggestedAction: this.suggestDuplicateAction(avgSimilarity)
        })
      }

      processed.add(pages[i].id)
    }

    return {
      duplicates: duplicateGroups,
      totalDuplicates: duplicateGroups.length,
      processingTime: Date.now() - startTime
    }
  }

  private async detectConflicts(pages: WikiPage[]): Promise<any[]> {
    const conflicts: any[] = []
    const titleMap = new Map<string, string[]>()

    pages.forEach(page => {
      const normalizedTitle = page.title.toLowerCase().trim()
      if (!titleMap.has(normalizedTitle)) {
        titleMap.set(normalizedTitle, [])
      }
      titleMap.get(normalizedTitle)!.push(page.id)
    })

    titleMap.forEach((pageIds, title) => {
      if (pageIds.length > 1) {
        conflicts.push({
          type: ConflictType.TITLE_CONFLICT,
          pageIds,
          description: `Multiple pages with similar title: "${title}"`
        })
      }
    })

    for (let i = 0; i < pages.length; i++) {
      for (let j = i + 1; j < pages.length; j++) {
        if (this.hasContentConflict(pages[i], pages[j])) {
          conflicts.push({
            type: ConflictType.CONTENT_CONFLICT,
            pageIds: [pages[i].id, pages[j].id],
            description: `Conflicting information between "${pages[i].title}" and "${pages[j].title}"`
          })
        }
      }
    }

    return conflicts
  }

  private calculateSimilarity(page1: WikiPage, page2: WikiPage): number {
    const titleSimilarity = this.stringSimilarity(page1.title, page2.title)
    const contentSimilarity = this.stringSimilarity(page1.content, page2.content)
    const tagSimilarity = this.tagSimilarity(page1.tags, page2.tags)

    return (titleSimilarity * 0.3) + (contentSimilarity * 0.6) + (tagSimilarity * 0.1)
  }

  private calculateGroupSimilarity(pages: WikiPage[]): number {
    if (pages.length < 2) return 1.0

    let totalSimilarity = 0
    let comparisons = 0

    for (let i = 0; i < pages.length; i++) {
      for (let j = i + 1; j < pages.length; j++) {
        totalSimilarity += this.calculateSimilarity(pages[i], pages[j])
        comparisons++
      }
    }

    return comparisons > 0 ? totalSimilarity / comparisons : 0
  }

  private stringSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2
    const shorter = str1.length > str2.length ? str2 : str1

    if (longer.length === 0) return 1.0

    const editDistance = this.levenshteinDistance(longer, shorter)
    return (longer.length - editDistance) / longer.length
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = []

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i]
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1]
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          )
        }
      }
    }

    return matrix[str2.length][str1.length]
  }

  private tagSimilarity(tags1: string[], tags2: string[]): number {
    const set1 = new Set(tags1.map(t => t.toLowerCase()))
    const set2 = new Set(tags2.map(t => t.toLowerCase()))
    const intersection = new Set([...set1].filter(tag => set2.has(tag)))
    const union = new Set([...set1, ...set2])

    return union.size > 0 ? intersection.size / union.size : 1.0
  }

  private classifyDuplicateType(similarity: number): DuplicateType {
    if (similarity >= 0.95) return DuplicateType.EXACT
    if (similarity >= 0.85) return DuplicateType.NEAR_EXACT
    if (similarity >= 0.7) return DuplicateType.SIMILAR
    return DuplicateType.RELATED
  }

  private suggestDuplicateAction(similarity: number): SuggestedAction {
    if (similarity >= 0.9) return SuggestedAction.MERGE
    if (similarity >= 0.8) return SuggestedAction.KEEP_LATEST
    if (similarity >= 0.7) return SuggestedAction.KEEP_HIGHEST_QUALITY
    return SuggestedAction.MANUAL_REVIEW
  }

  private async mergeDuplicatePages(pages: WikiPage[], strategy: MergeStrategy): Promise<WikiPage | null> {
    if (pages.length === 0) return null
    if (pages.length === 1) return pages[0]

    const latestPage = pages.reduce((latest, page) =>
      page.metadata.updatedAt > latest.metadata.updatedAt ? page : latest
    )

    switch (strategy) {
      case MergeStrategy.TEMPORAL:
        return latestPage

      case MergeStrategy.APPEND:
        return this.mergePageContents(pages)

      case MergeStrategy.SEMANTIC:
        return await this.mergeSemantically(pages)

      default:
        return latestPage
    }
  }

  private mergePageContents(pages: WikiPage[]): WikiPage {
    const basePage = pages.reduce((latest, page) =>
      page.metadata.updatedAt > latest.metadata.updatedAt ? page : latest
    )

    const mergedContent = pages
      .map(page => `# ${page.title}\n\n${page.content}`)
      .join('\n\n---\n\n')

    const mergedTags = [...new Set(pages.flatMap(page => page.tags))]

    return {
      ...basePage,
      content: mergedContent,
      tags: mergedTags,
      metadata: {
        ...basePage.metadata,
        updatedAt: new Date(),
        version: basePage.metadata.version + 1
      }
    }
  }

  private async mergeSemantically(pages: WikiPage[]): Promise<WikiPage> {
    return this.mergePageContents(pages)
  }

  private hasContentConflict(page1: WikiPage, page2: WikiPage): boolean {
    const similarity = this.calculateSimilarity(page1, page2)
    return similarity > 0.3 && similarity < 0.8
  }

  private async resolveConflict(conflict: any, strategy: ConflictResolutionStrategy): Promise<ConflictResolution | null> {
    const resolution: ConflictResolution = {
      pageId: conflict.pageIds[0],
      conflictType: conflict.type,
      resolution: strategy,
      resolvedAt: new Date(),
      resolvedBy: 'system'
    }

    return resolution
  }

  private async applyResolution(pages: WikiPage[], resolution: ConflictResolution): Promise<void> {
  }

  private async buildWikiStructure(pages: WikiPage[], strategy: AggregationStrategy): Promise<WikiStructure> {
    const hierarchy = this.buildHierarchy(pages)
    const categories = this.buildCategories(pages)
    const relationships = this.buildRelationships(pages)

    return {
      hierarchy,
      categories,
      relationships
    }
  }

  private buildHierarchy(pages: WikiPage[]): WikiHierarchyNode[] {
    return pages.map((page, index) => ({
      id: this.generateId(),
      title: page.title,
      level: 0,
      children: [],
      pageId: page.id,
      weight: index
    }))
  }

  private buildCategories(pages: WikiPage[]): WikiCategory[] {
    const categoryMap = new Map<string, WikiCategory>()

    pages.forEach(page => {
      const category = this.inferCategory(page)
      if (!categoryMap.has(category)) {
        categoryMap.set(category, {
          id: this.generateId(),
          name: category,
          pageIds: [],
          children: []
        })
      }
      categoryMap.get(category)!.pageIds.push(page.id)
    })

    return Array.from(categoryMap.values())
  }

  private buildRelationships(pages: WikiPage[]): WikiRelationshipMap {
    const dependencies = new Map<string, string[]>()
    const references = new Map<string, string[]>()
    const similarities = new Map<string, string[]>()

    pages.forEach(page => {
      dependencies.set(page.id, [])
      references.set(page.id, [])
      similarities.set(page.id, [])
    })

    for (let i = 0; i < pages.length; i++) {
      for (let j = i + 1; j < pages.length; j++) {
        const similarity = this.calculateSimilarity(pages[i], pages[j])
        if (similarity > 0.5) {
          similarities.get(pages[i].id)!.push(pages[j].id)
          similarities.get(pages[j].id)!.push(pages[i].id)
        }
      }
    }

    return { dependencies, references, similarities }
  }

  private async buildAggregatedIndex(pages: WikiPage[]): Promise<WikiIndex> {
    return {
      pages: new Map(),
      categories: new Map(),
      tags: new Map(),
      searchIndex: {
        documents: new Map(),
        terms: new Map(),
        metadata: {
          totalDocuments: pages.length,
          totalTerms: 0,
          lastUpdated: new Date(),
          version: 1
        }
      },
      metadata: {
        projectId: pages[0]?.metadata.projectId || 'unknown',
        totalPages: pages.length,
        totalCategories: 0,
        totalTags: 0,
        lastUpdated: new Date(),
        version: 1
      }
    }
  }

  private inferCategory(page: WikiPage): string {
    if (page.languageId) {
      const languageMap: Record<string, string> = {
        'typescript': 'TypeScript',
        'javascript': 'JavaScript',
        'python': 'Python',
        'java': 'Java',
        'csharp': 'C#',
        'cpp': 'C++',
        'go': 'Go',
        'rust': 'Rust'
      }
      return languageMap[page.languageId] || 'General'
    }
    return 'General'
  }

  private extractCommonTags(pages: WikiPage[]): string[] {
    const tagFrequency = new Map<string, number>()

    pages.forEach(page => {
      page.tags.forEach(tag => {
        tagFrequency.set(tag, (tagFrequency.get(tag) || 0) + 1)
      })
    })

    return Array.from(tagFrequency.entries())
      .filter(([, count]) => count > 1)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([tag]) => tag)
  }

  private calculateStatistics(
    pages: WikiPage[],
    duplicateDetection: DuplicateDetectionResult,
    conflicts: any[]
  ): AggregationStatistics {
    const categories = new Set(pages.map(page => this.inferCategory(page)))
    const allTags = new Set(pages.flatMap(page => page.tags))

    return {
      totalPages: pages.length,
      totalCategories: categories.size,
      totalTags: allTags.size,
      duplicatesFound: duplicateDetection.totalDuplicates,
      conflictsResolved: conflicts.length,
      pagesMerged: duplicateDetection.duplicates.length,
      pagesAdded: pages.length,
      pagesRemoved: 0
    }
  }

  private async validateAggregatedWiki(wiki: AggregatedWiki): Promise<AggregationIssue[]> {
    const issues: AggregationIssue[] = []

    if (wiki.pages.length === 0) {
      issues.push({
        type: IssueType.MISSING_METADATA,
        severity: IssueSeverity.HIGH,
        message: 'Aggregated wiki contains no pages',
        suggestedAction: 'Check source pages and aggregation strategy'
      })
    }

    return issues
  }

  private generateWarnings(wiki: AggregatedWiki, duplicateDetection: DuplicateDetectionResult): AggregationWarning[] {
    const warnings: AggregationWarning[] = []

    if (duplicateDetection.totalDuplicates > 0) {
      warnings.push({
        type: WarningType.SIMILAR_CONTENT,
        message: `Found ${duplicateDetection.totalDuplicates} duplicate page groups`,
        recommendation: 'Review duplicate groups and merge if appropriate'
      })
    }

    return warnings
  }

  private initializeDefaultStrategies(): void {
    const defaultStrategy: AggregationStrategy = {
      id: 'default',
      name: 'Default Aggregation Strategy',
      type: 'automatic' as any,
      rules: [],
      mergeStrategy: MergeStrategy.SEMANTIC,
      conflictResolution: ConflictResolutionStrategy.LATEST_WINS,
      priority: 1,
      enabled: true
    }

    this.strategies.set(defaultStrategy.id, defaultStrategy)
  }

  private getDefaultStrategy(): AggregationStrategy {
    return this.strategies.get('default')!
  }

  private async getProjectPages(projectId: string): Promise<WikiPage[]> {
    return []
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2, 11)
  }
}