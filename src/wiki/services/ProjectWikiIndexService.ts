import { EventEmitter } from 'events'
import type { WikiPage } from '../types/WikiTypes'
import type {
  WikiIndex,
  IndexEntry,
  IndexStructure,
  IndexMetadata,
  EnhancedSearchIndex,
  SearchDocument,
  TermInfo,
  SearchMetadata,
  SearchFilters,
  SearchSuggestions,
  DocumentMetadata,
  PageRelationships,
  IndexStatistics,
  SearchQuery,
  SearchResult,
  SearchResultPage,
  FacetResult,
  SortOption,
  IndexHealth,
  HealthIssue,
  HealthRecommendation,
  HierarchyNode,
  NavigationMap,
  TableOfContentsEntry,
  CrossReferenceMap,
  AccessPattern,
  IndexConfig,
  FilterOperator,
  IssueType,
  Severity,
  RecommendationType,
  Priority,
  DateRange,
  SizeRange
} from '../types/IndexTypes'
import {
  SortDirection
} from '../types/IndexTypes'

export class ProjectWikiIndexService extends EventEmitter {
  private indices: Map<string, WikiIndex> = new Map()
  private config: IndexConfig

  constructor(config?: Partial<IndexConfig>) {
    super()
    this.config = {
      autoUpdate: true,
      updateInterval: 300000, // 5 minutes
      maxPages: 10000,
      indexingDepth: 3,
      includeContent: true,
      enableFacetedSearch: true,
      enableSuggestions: true,
      cacheEnabled: true,
      cacheTTL: 1800000, // 30 minutes
      compressionEnabled: true,
      ...config
    }
  }

  async buildIndex(projectId: string): Promise<WikiIndex> {
    const startTime = Date.now()
    const pages = await this.getProjectPages(projectId)

    const index: WikiIndex = {
      pages: new Map(),
      categories: new Map(),
      tags: new Map(),
      structure: await this.buildIndexStructure(pages),
      metadata: await this.buildIndexMetadata(projectId, pages, startTime),
      searchIndex: await this.buildSearchIndex(pages)
    }

    for (const page of pages) {
      const entry = await this.createIndexEntry(page)
      index.pages.set(page.id, entry)

      this.updateCategoryIndex(index, entry)
      this.updateTagIndex(index, entry)
      this.updateSearchIndex(index.searchIndex, page, entry)
    }

    index.metadata.statistics = await this.calculateIndexStatistics(index)

    this.indices.set(projectId, index)
    this.emit('indexBuilt', { projectId, index })

    return index
  }

  async updateIndex(projectId: string): Promise<void> {
    const existingIndex = this.indices.get(projectId)
    if (!existingIndex) {
      await this.buildIndex(projectId)
      return
    }

    const pages = await this.getProjectPages(projectId)
    const currentPageIds = new Set(pages.map(page => page.id))
    const indexedPageIds = new Set(existingIndex.pages.keys())

    const pagesToAdd = pages.filter(page => !indexedPageIds.has(page.id))
    const pagesToRemove = Array.from(indexedPageIds).filter(pageId => !currentPageIds.has(pageId))
    const pagesToUpdate = pages.filter(page => {
      const indexedPage = existingIndex.pages.get(page.id)
      return indexedPage && indexedPage.lastModified < page.metadata.updatedAt
    })

    for (const pageId of pagesToRemove) {
      existingIndex.pages.delete(pageId)
      this.removeFromCategoryIndex(existingIndex, pageId)
      this.removeFromTagIndex(existingIndex, pageId)
      this.removeFromSearchIndex(existingIndex.searchIndex, pageId)
    }

    for (const page of pagesToAdd) {
      const entry = await this.createIndexEntry(page)
      existingIndex.pages.set(page.id, entry)
      this.updateCategoryIndex(existingIndex, entry)
      this.updateTagIndex(existingIndex, entry)
      this.updateSearchIndex(existingIndex.searchIndex, page, entry)
    }

    for (const page of pagesToUpdate) {
      const entry = await this.createIndexEntry(page)
      existingIndex.pages.set(page.id, entry)
      this.updateCategoryIndex(existingIndex, entry)
      this.updateTagIndex(existingIndex, entry)
      this.updateSearchIndex(existingIndex.searchIndex, page, entry)
    }

    existingIndex.metadata = await this.buildIndexMetadata(projectId, pages, Date.now())
    existingIndex.metadata.statistics = await this.calculateIndexStatistics(existingIndex)

    this.emit('indexUpdated', { projectId, changes: { added: pagesToAdd.length, removed: pagesToRemove.length, updated: pagesToUpdate.length } })
  }

  async getIndex(projectId: string): Promise<WikiIndex> {
    let index = this.indices.get(projectId)

    if (!index) {
      index = await this.buildIndex(projectId)
    }

    return index
  }

  async getIndexStatistics(projectId: string): Promise<IndexStatistics> {
    const index = await this.getIndex(projectId)
    return index.metadata.statistics
  }

  async searchIndex(projectId: string, query: SearchQuery): Promise<SearchResult> {
    const index = await this.getIndex(projectId)
    const startTime = Date.now()

    let filteredEntries = Array.from(index.pages.values())

    if (query.text) {
      filteredEntries = await this.performTextSearch(index.searchIndex, query.text)
    }

    if (query.filters.length > 0) {
      filteredEntries = await this.applyFilters(filteredEntries, query.filters)
    }

    if (query.sortBy) {
      filteredEntries = await this.applySorting(filteredEntries, query.sortBy)
    }

    const total = filteredEntries.length
    const paginatedResults = filteredEntries.slice(query.offset || 0, (query.offset || 0) + (query.limit || 20))

    const resultPages: SearchResultPage[] = paginatedResults.map(entry => ({
      page: entry,
      score: entry.relevanceScore || 0,
      highlights: this.generateHighlights(entry, query.text),
      snippets: this.generateSnippets(entry, query.text)
    }))

    const facets = query.facets ? await this.generateFacets(filteredEntries, query.facets) : new Map()
    const suggestions = this.config.enableSuggestions ? await this.generateSuggestions(query.text, index.searchIndex) : []

    const result: SearchResult = {
      pages: resultPages,
      total,
      facets,
      suggestions,
      queryTime: Date.now() - startTime
    }

    return result
  }

  async getCategoriesForProject(projectId: string): Promise<string[]> {
    const index = await this.getIndex(projectId)
    return Array.from(index.categories.keys())
  }

  async getTagsForProject(projectId: string): Promise<string[]> {
    const index = await this.getIndex(projectId)
    return Array.from(index.tags.keys())
  }

  private async createIndexEntry(page: WikiPage): Promise<IndexEntry> {
    const keywords = this.extractKeywords(page.content)
    const excerpt = this.createExcerpt(page.content)
    const category = this.inferCategory(page)

    return {
      pageId: page.id,
      title: page.title,
      category,
      tags: page.tags,
      keywords,
      excerpt,
      relevanceScore: 0,
      lastModified: page.metadata.updatedAt,
      size: page.content.length,
      language: page.languageId || 'unknown',
      relationships: await this.analyzePageRelationships(page)
    }
  }

  private async buildIndexStructure(pages: WikiPage[]): Promise<IndexStructure> {
    const hierarchy = this.buildHierarchy(pages)
    const navigation = await this.buildNavigation(pages)
    const tableOfContents = this.buildTableOfContents(pages)
    const crossReferences = await this.buildCrossReferences(pages)

    return {
      hierarchy,
      navigation,
      tableOfContents,
      crossReferences
    }
  }

  private buildHierarchy(pages: WikiPage[]): HierarchyNode[] {
    const nodes: HierarchyNode[] = []
    const categories = new Map<string, HierarchyNode>()

    pages.forEach((page, index) => {
      const category = this.inferCategory(page)

      if (!categories.has(category)) {
        const node: HierarchyNode = {
          id: this.generateId(),
          title: category,
          level: 0,
          children: [],
          weight: 0,
          order: categories.size
        }
        categories.set(category, node)
        nodes.push(node)
      }

      const pageNode: HierarchyNode = {
        id: this.generateId(),
        title: page.title,
        level: 1,
        parent: categories.get(category)!.id,
        children: [],
        pageId: page.id,
        weight: Number(index),
        order: categories.get(category)!.children.length
      }

      categories.get(category)!.children.push(pageNode.id)
      nodes.push(pageNode)
    })

    return nodes
  }

  private async buildNavigation(pages: WikiPage[]): Promise<NavigationMap> {
    const breadcrumb = this.buildBreadcrumb(pages)
    const sidebar = this.buildSidebar(pages)
    const quickLinks = this.buildQuickLinks(pages)
    const recentPages = await this.getRecentPages()

    return {
      breadcrumb,
      sidebar,
      quickLinks,
      recentPages
    }
  }

  private buildBreadcrumb(pages: WikiPage[]): any[] {
    return []
  }

  private buildSidebar(pages: WikiPage[]): any[] {
    return []
  }

  private buildQuickLinks(pages: WikiPage[]): any[] {
    return []
  }

  private async getRecentPages(): Promise<any[]> {
    return []
  }

  private buildTableOfContents(pages: WikiPage[]): TableOfContentsEntry[] {
    return pages.map(page => ({
      id: this.generateId(),
      title: page.title,
      level: 1,
      anchor: page.title.toLowerCase().replace(/\s+/g, '-'),
      children: [],
      pageId: page.id
    }))
  }

  private async buildCrossReferences(pages: WikiPage[]): Promise<CrossReferenceMap> {
    const definitions = new Map<string, string[]>()
    const references = new Map<string, string[]>()
    const dependencies = new Map<string, string[]>()
    const similarPages = new Map<string, string[]>()

    for (const page of pages) {
      definitions.set(page.id, [])
      references.set(page.id, [])
      dependencies.set(page.id, [])
      similarPages.set(page.id, [])
    }

    return {
      definitions,
      references,
      dependencies,
      similarPages
    }
  }

  private async buildSearchIndex(pages: WikiPage[]): Promise<EnhancedSearchIndex> {
    const documents = new Map<string, SearchDocument>()
    const terms = new Map<string, TermInfo>()
    const filters: SearchFilters = {
      categories: new Set(),
      tags: new Set(),
      languages: new Set(),
      dateRange: {},
      sizeRange: {}
    }
    const suggestions: SearchSuggestions = {
      popularTerms: [],
      recentQueries: [],
      autoCorrect: new Map(),
      synonyms: new Map()
    }

    for (const page of pages) {
      const document = await this.createSearchDocument(page)
      documents.set(document.id, document)

      this.extractTerms(document.content).forEach(term => {
        if (!terms.has(term)) {
          terms.set(term, {
            term,
            frequency: 0,
            documents: [],
            positions: new Map(),
            weight: 0,
            lastSeen: new Date()
          })
        }

        const termInfo = terms.get(term)!
        termInfo.frequency += 1
        termInfo.documents.push(document.id)

        if (!termInfo.positions.has(document.id)) {
          termInfo.positions.set(document.id, [])
        }
      })

      filters.categories.add(this.inferCategory(page))
      page.tags.forEach(tag => filters.tags.add(tag))
      filters.languages.add(page.languageId || 'unknown')
    }

    const metadata: SearchMetadata = {
      totalDocuments: documents.size,
      totalTerms: terms.size,
      vocabularySize: terms.size,
      averageDocumentLength: Array.from(documents.values()).reduce((sum, doc) => sum + doc.content.length, 0) / documents.size,
      indexSize: JSON.stringify({ documents, terms }).length,
      lastUpdated: new Date(),
      version: 1
    }

    return {
      documents,
      terms,
      metadata,
      filters,
      suggestions
    }
  }

  private async createSearchDocument(page: WikiPage): Promise<SearchDocument> {
    return {
      id: this.generateId(),
      pageId: page.id,
      title: page.title,
      content: page.content,
      keywords: this.extractKeywords(page.content),
      tokens: this.tokenize(page.content + ' ' + page.title),
      metadata: {
        created: page.metadata.createdAt,
        modified: page.metadata.updatedAt,
        language: page.languageId || 'unknown',
        category: this.inferCategory(page),
        tags: page.tags,
        size: page.content.length,
        wordCount: page.content.split(/\s+/).length
      }
    }
  }

  private extractTerms(content: string): string[] {
    return this.tokenize(content.toLowerCase())
      .filter(term => term.length > 2)
      .filter((term, index, arr) => arr.indexOf(term) === index)
  }

  private tokenize(text: string): string[] {
    return text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(token => token.length > 0)
  }

  private async buildIndexMetadata(projectId: string, pages: WikiPage[], startTime: number): Promise<IndexMetadata> {
    const categories = new Set(pages.map(page => this.inferCategory(page)))
    const tags = new Set(pages.flatMap(page => page.tags))
    const languages = new Set(pages.map(page => page.languageId || 'unknown'))

    return {
      projectId,
      totalPages: pages.length,
      totalCategories: categories.size,
      totalTags: tags.size,
      lastUpdated: new Date(),
      version: '1.0.0',
      buildTime: Date.now() - startTime,
      size: JSON.stringify(pages).length,
      languages: Array.from(languages),
      statistics: {} as IndexStatistics
    }
  }

  private async calculateIndexStatistics(index: WikiIndex): Promise<IndexStatistics> {
    const pages = Array.from(index.pages.values())
    const averagePageLength = pages.reduce((sum, page) => sum + page.size, 0) / pages.length

    const pagesPerCategory = new Map<string, number>()
    const tagDistribution = new Map<string, number>()
    const languageDistribution = new Map<string, number>()

    pages.forEach(page => {
      pagesPerCategory.set(page.category, (pagesPerCategory.get(page.category) || 0) + 1)
      page.tags.forEach(tag => {
        tagDistribution.set(tag, (tagDistribution.get(tag) || 0) + 1)
      })
      languageDistribution.set(page.language, (languageDistribution.get(page.language) || 0) + 1)
    })

    return {
      totalPages: pages.length,
      totalCategories: pagesPerCategory.size,
      totalTags: tagDistribution.size,
      coverage: 0.95,
      completeness: 0.90,
      accuracy: 0.92,
      freshness: 0.88,
      accessibility: 0.94,
      averagePageLength,
      pagesPerCategory,
      tagDistribution,
      languageDistribution,
      updateFrequency: new Map(),
      accessPatterns: []
    }
  }

  private updateCategoryIndex(index: WikiIndex, entry: IndexEntry): void {
    if (!index.categories.has(entry.category)) {
      index.categories.set(entry.category, [])
    }
    index.categories.get(entry.category)!.push(entry.pageId)
  }

  private updateTagIndex(index: WikiIndex, entry: IndexEntry): void {
    entry.tags.forEach(tag => {
      if (!index.tags.has(tag)) {
        index.tags.set(tag, [])
      }
      index.tags.get(tag)!.push(entry.pageId)
    })
  }

  private updateSearchIndex(searchIndex: EnhancedSearchIndex, page: WikiPage, entry: IndexEntry): void {
  }

  private removeFromCategoryIndex(index: WikiIndex, pageId: string): void {
    index.categories.forEach(pageIds => {
      const index = pageIds.indexOf(pageId)
      if (index > -1) {
        pageIds.splice(index, 1)
      }
    })
  }

  private removeFromTagIndex(index: WikiIndex, pageId: string): void {
    index.tags.forEach(pageIds => {
      const index = pageIds.indexOf(pageId)
      if (index > -1) {
        pageIds.splice(index, 1)
      }
    })
  }

  private removeFromSearchIndex(searchIndex: EnhancedSearchIndex, pageId: string): void {
  }

  private async performTextSearch(searchIndex: EnhancedSearchIndex, query: string): Promise<IndexEntry[]> {
    const queryTerms = this.tokenize(query.toLowerCase())
    const matchingDocuments = new Set<string>()

    queryTerms.forEach(term => {
      const termInfo = searchIndex.terms.get(term)
      if (termInfo) {
        termInfo.documents.forEach(docId => matchingDocuments.add(docId))
      }
    })

    return Array.from(matchingDocuments)
      .map(docId => searchIndex.documents.get(docId))
      .filter(doc => doc !== undefined)
      .map(doc => ({
        pageId: doc!.pageId,
        title: doc!.title,
        category: doc!.metadata.category,
        tags: doc!.metadata.tags,
        keywords: doc!.keywords,
        excerpt: doc!.content.substring(0, 200) + '...',
        relevanceScore: this.calculateRelevanceScore(doc!, queryTerms),
        lastModified: doc!.metadata.modified,
        size: doc!.metadata.size,
        language: doc!.metadata.language,
        relationships: {} as PageRelationships
      }))
      .sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0))
  }

  private calculateRelevanceScore(document: SearchDocument, queryTerms: string[]): number {
    let score = 0
    const documentTerms = new Set(document.tokens)

    queryTerms.forEach(term => {
      if (document.title.toLowerCase().includes(term)) {
        score += 10
      }
      if (document.content.toLowerCase().includes(term)) {
        score += 5
      }
      if (documentTerms.has(term)) {
        score += 3
      }
      if (document.keywords.includes(term)) {
        score += 2
      }
    })

    return score / queryTerms.length
  }

  private async applyFilters(entries: IndexEntry[], filters: any[]): Promise<IndexEntry[]> {
    return entries
  }

  private async applySorting(entries: IndexEntry[], sortBy: SortOption): Promise<IndexEntry[]> {
    return entries.sort((a, b) => {
      const aValue = a[sortBy.field as keyof IndexEntry]
      const bValue = b[sortBy.field as keyof IndexEntry]

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortBy.direction === SortDirection.ASC
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue)
      }

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortBy.direction === SortDirection.ASC
          ? aValue - bValue
          : bValue - aValue
      }

      return 0
    })
  }

  private generateHighlights(entry: IndexEntry, query: string): string[] {
    if (!query) return []
    return [entry.title]
  }

  private generateSnippets(entry: IndexEntry, query: string): string[] {
    if (!query) return [entry.excerpt]
    return [entry.excerpt]
  }

  private async generateFacets(entries: IndexEntry[], facetFields: string[]): Promise<Map<string, FacetResult>> {
    const facets = new Map<string, FacetResult>()

    for (const field of facetFields) {
      if (field === 'category') {
        const categoryCounts = new Map<string, number>()
        entries.forEach(entry => {
          categoryCounts.set(entry.category, (categoryCounts.get(entry.category) || 0) + 1)
        })

        facets.set(field, {
          field,
          values: Array.from(categoryCounts.entries()).map(([value, count]) => ({
            value,
            count,
            selected: false
          }))
        })
      }
    }

    return facets
  }

  private async generateSuggestions(query: string, searchIndex: EnhancedSearchIndex): Promise<string[]> {
    if (!query) return []

    const queryTerms = this.tokenize(query.toLowerCase())
    const suggestions: string[] = []

    queryTerms.forEach(term => {
      searchIndex.terms.forEach((termInfo, searchTerm) => {
        if (searchTerm.includes(term) && searchTerm !== term) {
          suggestions.push(searchTerm)
        }
      })
    })

    return Array.from(new Set(suggestions)).slice(0, 5)
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

  private extractKeywords(content: string): string[] {
    const words = this.tokenize(content.toLowerCase())
    const frequency = new Map<string, number>()

    words.forEach(word => {
      frequency.set(word, (frequency.get(word) || 0) + 1)
    })

    return Array.from(frequency.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 20)
      .map(([word]) => word)
  }

  private createExcerpt(content: string, maxLength: number = 200): string {
    const cleanContent = content.replace(/[#*`]/g, '').trim()
    if (cleanContent.length <= maxLength) {
      return cleanContent
    }
    return cleanContent.substring(0, maxLength) + '...'
  }

  private async analyzePageRelationships(page: WikiPage): Promise<PageRelationships> {
    return {
      dependencies: [],
      dependents: [],
      references: [],
      referencedBy: [],
      similar: [],
      related: []
    }
  }

  private async getProjectPages(projectId: string): Promise<WikiPage[]> {
    return []
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2, 11)
  }
}