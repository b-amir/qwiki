import { EventEmitter } from 'events'
import type { WikiPage } from '../types/WikiTypes'
import type {
  SearchQuery,
  SearchResult,
  SearchResultPage,
  SearchResultDocument,
  DocumentMetadata,
  SearchFilter,
  SortOption,
  QueryBoost,
  HighlightConfig,
  SnippetConfig,
  FacetResult,
  SearchSuggestion,
  AggregationResult,
  PaginationInfo,
  SearchIndex,
  SearchDocument,
  TermInfo,
  FieldInfo,
  SearchIndexMetadata,
  IndexStatistics,
  Analyzer,
  Tokenizer,
  TokenFilter,
  CharFilter,
  SearchConfig,
  MissingValueHandling,
  BoostCondition,
  HighlightOrder,
  ResultExplanation,
  ExplanationDetail,
  FactorBreakdown
} from '../types/SearchTypes'
import {
  SearchField,
  SortField,
  FilterOperator,
  SortDirection,
  SortMode,
  SuggestionType,
  ExplanationType,
  FacetType,
  AggregationType,
  FieldType,
  SimilarityType,
  TokenizerType,
  FilterType,
  CharFilterType,
  QueryOperator,
  DifficultyLevel
} from '../types/SearchTypes'

export class WikiSearchService extends EventEmitter {
  private indices: Map<string, SearchIndex> = new Map()
  private config: SearchConfig
  private cache: Map<string, SearchResult> = new Map()
  private queryStats: Map<string, number> = new Map()

  constructor(config?: Partial<SearchConfig>) {
    super()
    this.config = {
      defaultLimit: 20,
      maxLimit: 100,
      defaultSort: [
        { field: SortField.SCORE, direction: SortDirection.DESC, mode: SortMode.MAX }
      ],
      enableHighlight: true,
      enableSnippets: true,
      enableFacets: true,
      enableSuggestions: true,
      cacheEnabled: true,
      cacheTTL: 300000, // 5 minutes
      indexRefreshInterval: 60000, // 1 minute
      queryTimeout: 10000 // 10 seconds
    }
  }

  async search(projectId: string, query: SearchQuery): Promise<SearchResult> {
    const startTime = Date.now()

    if (this.config.cacheEnabled) {
      const cacheKey = this.getCacheKey(projectId, query)
      const cachedResult = this.cache.get(cacheKey)
      if (cachedResult && this.isCacheValid(cachedResult)) {
        this.emit('cacheHit', { projectId, query })
        return cachedResult
      }
    }

    try {
      const index = await this.getSearchIndex(projectId)
      const result = await this.executeSearch(index, query)

      if (this.config.cacheEnabled) {
        const cacheKey = this.getCacheKey(projectId, query)
        this.cache.set(cacheKey, result)
        setTimeout(() => this.cache.delete(cacheKey), this.config.cacheTTL)
      }

      this.updateQueryStats(query.text, result.pages.length)
      this.emit('searchCompleted', { projectId, query, result })

      return result

    } catch (error) {
      this.emit('searchError', { projectId, query, error })
      throw error
    }
  }

  async fullTextSearch(projectId: string, text: string): Promise<SearchResultDocument[]> {
    const query: SearchQuery = {
      text,
      filters: [],
      sortBy: { field: SortField.RELEVANCE, direction: SortDirection.DESC, mode: SortMode.MAX },
      limit: this.config.defaultLimit,
      highlight: this.config.enableHighlight ? {
        enabled: true,
        fields: [
          { field: SearchField.TITLE, fragmentSize: 150 },
          { field: SearchField.CONTENT, fragmentSize: 300 }
        ],
        preTag: '<mark>',
        postTag: '</mark>',
        numberOfFragments: 3
      } : undefined
    }

    const result = await this.search(projectId, query)
    return result.pages.map(page => page.page)
  }

  async filterPages(projectId: string, filters: SearchFilter[]): Promise<SearchResultDocument[]> {
    const query: SearchQuery = {
      text: '',
      filters,
      sortBy: { field: SortField.UPDATED_AT, direction: SortDirection.DESC, mode: SortMode.MAX },
      limit: this.config.defaultLimit
    }

    const result = await this.search(projectId, query)
    return result.pages.map(page => page.page)
  }

  async getSuggestions(projectId: string, query: string): Promise<string[]> {
    if (!this.config.enableSuggestions) {
      return []
    }

    const index = await this.getSearchIndex(projectId)
    const suggestions = await this.generateSuggestions(index, query)

    return suggestions
      .filter(suggestion => suggestion.score > 0.1)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
      .map(suggestion => suggestion.text)
  }

  async getRelatedPages(pageId: string, limit?: number): Promise<SearchResultDocument[]> {
    const page = await this.findPageById(pageId)
    if (!page || !page.metadata) {
      return []
    }

    const similarQuery: SearchQuery = {
      text: page.title || '',
      filters: [
        {
          field: SearchField.CATEGORY,
          operator: FilterOperator.EQUALS,
          value: page.metadata.category
        },
        {
          field: SearchField.TAGS,
          operator: FilterOperator.CONTAINS,
          value: page.metadata.tags
        }
      ],
      sortBy: { field: SortField.SCORE, direction: SortDirection.DESC, mode: SortMode.MAX },
      limit: limit || 10
    }

    const result = await this.search(page.metadata.projectId, similarQuery)
    return result.pages.filter(pageResult => pageResult.page.id !== pageId).map(pageResult => pageResult.page)
  }

  private async executeSearch(index: SearchIndex, query: SearchQuery): Promise<SearchResult> {
    const startTime = Date.now()

    let documents = Array.from(index.documents.values())

    if (query.text) {
      documents = await this.applyTextFilter(documents, query.text, index)
    }

    if (query.filters.length > 0) {
      documents = await this.applyFilters(documents, query.filters)
    }

    if (query.sortBy) {
      documents = await this.applySorting(documents, query.sortBy)
    }

    const total = documents.length
    const offset = query.offset || 0
    const limit = Math.min(query.limit || this.config.defaultLimit, this.config.maxLimit)
    const paginatedDocuments = documents.slice(offset, offset + limit)

    const resultPages: SearchResultPage[] = await Promise.all(
      paginatedDocuments.map(doc => this.createSearchResultPage(doc, query, index))
    )

    const facets = query.facets ? await this.generateFacets(documents, query.facets, index) : new Map()
    const suggestions = this.config.enableSuggestions ? await this.generateSuggestions(index, query.text) : []
    const aggregations = await this.generateAggregations(documents, query, index)

    const pagination: PaginationInfo = {
      current: Math.floor(offset / limit) + 1,
      pageSize: limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNext: offset + limit < total,
      hasPrevious: offset > 0,
      nextOffset: offset + limit < total ? offset + limit : undefined,
      previousOffset: offset > 0 ? Math.max(0, offset - limit) : undefined
    }

    const maxScore = resultPages.length > 0 ? Math.max(...resultPages.map(page => page.score)) : 0

    return {
      pages: resultPages,
      total,
      maxScore,
      took: Date.now() - startTime,
      facets,
      suggestions,
      aggregations,
      pagination,
      query
    }
  }

  private async applyTextFilter(documents: SearchDocument[], text: string, index: SearchIndex): Promise<SearchDocument[]> {
    const queryTerms = this.tokenizeQuery(text.toLowerCase())
    const scoredDocuments: Array<{ doc: SearchDocument; score: number }> = []

    for (const doc of documents) {
      const score = this.calculateRelevanceScore(doc, queryTerms, index)
      if (score > 0) {
        scoredDocuments.push({ doc, score })
      }
    }

    return scoredDocuments
      .sort((a, b) => b.score - a.score)
      .map(item => ({
        ...item.doc,
        _score: item.score
      }))
  }

  private calculateRelevanceScore(doc: SearchDocument, queryTerms: string[], index: SearchIndex): number {
    let score = 0
    const title = (doc.fields.get('title') as string || '').toLowerCase()
    const content = (doc.fields.get('content') as string || '').toLowerCase()
    const tags = (doc.fields.get('tags') as string[] || []).map(tag => tag.toLowerCase())

    queryTerms.forEach(term => {
      if (title.includes(term)) {
        score += 10
        if (title === term) score += 5
      }
      if (content.includes(term)) {
        score += 5
        const termCount = (content.match(new RegExp(term, 'g')) || []).length
        score += Math.min(termCount, 3)
      }
      if (tags.some(tag => tag.includes(term))) {
        score += 3
      }
    })

    const coverage = queryTerms.filter(term =>
      title.includes(term) || content.includes(term) || tags.some(tag => tag.includes(term))
    ).length / queryTerms.length

    score *= (1 + coverage)

    return score
  }

  private async applyFilters(documents: SearchDocument[], filters: SearchFilter[]): Promise<SearchDocument[]> {
    return documents.filter(doc => {
      return filters.every(filter => this.matchesFilter(doc, filter))
    })
  }

  private matchesFilter(doc: SearchDocument, filter: SearchFilter): boolean {
    const fieldValue = doc.fields.get(filter.field)
    const filterValue = filter.value

    switch (filter.operator) {
      case FilterOperator.EQUALS:
        return fieldValue === filterValue
      case FilterOperator.NOT_EQUALS:
        return fieldValue !== filterValue
      case FilterOperator.CONTAINS:
        return Array.isArray(fieldValue)
          ? fieldValue.some(val => String(val).toLowerCase().includes(String(filterValue).toLowerCase()))
          : String(fieldValue).toLowerCase().includes(String(filterValue).toLowerCase())
      case FilterOperator.NOT_CONTAINS:
        return !this.matchesFilter(doc, { ...filter, operator: FilterOperator.CONTAINS })
      case FilterOperator.IN:
        return Array.isArray(filterValue) && filterValue.includes(fieldValue)
      case FilterOperator.NOT_IN:
        return !this.matchesFilter(doc, { ...filter, operator: FilterOperator.IN })
      case FilterOperator.GREATER_THAN:
        return Number(fieldValue) > Number(filterValue)
      case FilterOperator.LESS_THAN:
        return Number(fieldValue) < Number(filterValue)
      case FilterOperator.EXISTS:
        return fieldValue !== undefined && fieldValue !== null
      case FilterOperator.NOT_EXISTS:
        return fieldValue === undefined || fieldValue === null
      default:
        return true
    }
  }

  private async applySorting(documents: SearchDocument[], sortBy: SortOption): Promise<SearchDocument[]> {
    return documents.sort((a, b) => {
      const aValue = this.getFieldValue(a, sortBy.field)
      const bValue = this.getFieldValue(b, sortBy.field)

      if (sortBy.field === SortField.SCORE) {
        const aScore = a._score || 0
        const bScore = b._score || 0
        return sortBy.direction === SortDirection.DESC ? bScore - aScore : aScore - bScore
      }

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

      if (aValue instanceof Date && bValue instanceof Date) {
        return sortBy.direction === SortDirection.ASC
          ? aValue.getTime() - bValue.getTime()
          : bValue.getTime() - aValue.getTime()
      }

      return 0
    })
  }

  private getFieldValue(doc: SearchDocument, field: SortField): any {
    switch (field) {
      case SortField.TITLE:
        return doc.fields.get('title')
      case SortField.CREATED_AT:
        return doc.metadata.createdAt
      case SortField.UPDATED_AT:
        return doc.metadata.updatedAt
      case SortField.SIZE:
        return doc.metadata.size
      case SortField.SCORE:
        return doc._score || 0
      default:
        return doc.fields.get(field)
    }
  }

  private async createSearchResultPage(doc: SearchDocument, query: SearchQuery, index: SearchIndex): Promise<SearchResultPage> {
    const highlights = new Map<string, string[]>()
    const snippets = new Map<string, string>()

    if (query.highlight?.enabled) {
      for (const highlightField of query.highlight.fields) {
        const fieldValue = doc.fields.get(highlightField.field) as string || ''
        const highlighted = this.generateHighlights(fieldValue, query.text, query.highlight)
        if (highlighted.length > 0) {
          highlights.set(highlightField.field, highlighted)
        }
      }
    }

    if (query.snippet?.enabled) {
      for (const snippetField of query.snippet.fields) {
        const fieldValue = doc.fields.get(snippetField.field) as string || ''
        const snippet = this.generateSnippet(fieldValue, snippetField.size || 200)
        if (snippet) {
          snippets.set(snippetField.field, snippet)
        }
      }
    }

    const resultDoc: SearchResultDocument = {
      id: doc.id,
      title: doc.fields.get('title') as string || '',
      content: doc.fields.get('content') as string || '',
      excerpt: this.generateExcerpt(doc.fields.get('content') as string || ''),
      url: `/wiki/${doc.id}`,
      metadata: doc.metadata,
      fields: doc.fields,
      _score: doc._score
    }

    return {
      page: resultDoc,
      score: doc._score || 0,
      highlights,
      snippets,
      explanation: this.generateExplanation(doc, query.text, index)
    }
  }

  private generateHighlights(content: string, query: string, config: HighlightConfig): string[] {
    if (!query) return []

    const queryTerms = this.tokenizeQuery(query.toLowerCase())
    const preTag = config.preTag || '<mark>'
    const postTag = config.postTag || '</mark>'
    const fragmentSize = config.fragmentSize || 150
    const numberOfFragments = config.numberOfFragments || 3

    let highlightedContent = content
    queryTerms.forEach(term => {
      const regex = new RegExp(`(${this.escapeRegex(term)})`, 'gi')
      highlightedContent = highlightedContent.replace(regex, preTag + '$1' + postTag)
    })

    const fragments = highlightedContent.split(/\n+/)
      .filter(fragment => fragment.includes(preTag))
      .slice(0, numberOfFragments)
      .map(fragment => fragment.length > fragmentSize ? fragment.substring(0, fragmentSize) + '...' : fragment)

    return fragments
  }

  private generateSnippet(content: string, size: number): string {
    if (!content) return ''
    if (content.length <= size) return content
    return content.substring(0, size) + '...'
  }

  private generateExcerpt(content: string, maxLength: number = 200): string {
    const cleanContent = content.replace(/[#*`]/g, '').trim()
    if (cleanContent.length <= maxLength) {
      return cleanContent
    }
    return cleanContent.substring(0, maxLength) + '...'
  }

  private generateExplanation(doc: SearchDocument, query: string, index: SearchIndex): any {
    if (!query) return undefined

    const queryTerms = this.tokenizeQuery(query.toLowerCase())
    const details: any[] = []
    let totalScore = 0

    queryTerms.forEach(term => {
      const title = (doc.fields.get('title') as string || '').toLowerCase()
      const content = (doc.fields.get('content') as string || '').toLowerCase()

      if (title.includes(term)) {
        details.push({
          type: ExplanationType.TERM_MATCH,
          value: 10,
          description: `Term "${term}" found in title`,
          factors: [{
            factor: 'title_match',
            weight: 1.0,
            contribution: 10,
            normalizedValue: 1.0
          }]
        })
        totalScore += 10
      }

      if (content.includes(term)) {
        const termCount = (content.match(new RegExp(term, 'g')) || []).length
        const score = Math.min(5 + termCount, 8)
        details.push({
          type: ExplanationType.TERM_FREQ,
          value: score,
          description: `Term "${term}" found ${termCount} times in content`,
          factors: [{
            factor: 'term_frequency',
            weight: 1.0,
            contribution: score,
            normalizedValue: Math.min(termCount / 10, 1.0)
          }]
        })
        totalScore += score
      }
    })

    return {
      value: totalScore,
      description: `Relevance score based on term matching and frequency`,
      details
    }
  }

  private async generateFacets(documents: SearchDocument[], facetFields: string[], index: SearchIndex): Promise<Map<string, FacetResult>> {
    const facets = new Map<string, FacetResult>()

    for (const field of facetFields) {
      const values = new Map<string, number>()

      documents.forEach(doc => {
        const fieldValue = doc.fields.get(field)
        if (Array.isArray(fieldValue)) {
          fieldValue.forEach(value => {
            values.set(String(value), (values.get(String(value)) || 0) + 1)
          })
        } else if (fieldValue !== undefined && fieldValue !== null) {
          values.set(String(fieldValue), (values.get(String(fieldValue)) || 0) + 1)
        }
      })

      const buckets = Array.from(values.entries())
        .map(([key, docCount]) => ({
          key,
          docCount,
          selected: false
        }))
        .sort((a, b) => b.docCount - a.docCount)
        .slice(0, 10)

      facets.set(field, {
        field,
        type: FacetType.TERMS,
        buckets,
        total: buckets.length,
        missing: 0,
        other: Math.max(0, values.size - 10)
      })
    }

    return facets
  }

  private async generateSuggestions(index: SearchIndex, query: string): Promise<SearchSuggestion[]> {
    if (!query) return []

    const queryTerms = this.tokenizeQuery(query.toLowerCase())
    const suggestions: SearchSuggestion[] = []

    queryTerms.forEach(term => {
      index.terms.forEach((termInfo, searchTerm) => {
        if (searchTerm.startsWith(term) && searchTerm.length > term.length) {
          suggestions.push({
            text: searchTerm,
            type: SuggestionType.TERM,
            score: termInfo.docFrequency / index.documents.size,
            source: 'index_terms'
          })
        }
      })
    })

    const documentTitles = Array.from(index.documents.values())
      .map(doc => doc.fields.get('title') as string || '')
      .filter(title => title.toLowerCase().includes(query.toLowerCase()))

    documentTitles.forEach(title => {
      suggestions.push({
        text: title,
        type: SuggestionType.COMPLETION,
        score: 0.8,
        source: 'document_titles'
      })
    })

    return suggestions
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
  }

  private async generateAggregations(documents: SearchDocument[], query: SearchQuery, index: SearchIndex): Promise<Map<string, AggregationResult>> {
    const aggregations = new Map<string, AggregationResult>()

    const categoryCounts = new Map<string, number>()
    documents.forEach(doc => {
      const category = doc.metadata.category
      categoryCounts.set(category, (categoryCounts.get(category) || 0) + 1)
    })

    aggregations.set('categories', {
      name: 'categories',
      type: AggregationType.TERMS,
      buckets: Array.from(categoryCounts.entries()).map(([key, docCount]) => ({
        key,
        docCount
      }))
    })

    return aggregations
  }

  private async getSearchIndex(projectId: string): Promise<SearchIndex> {
    let index = this.indices.get(projectId)

    if (!index || !this.isIndexFresh(index)) {
      index = await this.buildSearchIndex(projectId)
      this.indices.set(projectId, index)
    }

    return index
  }

  private async buildSearchIndex(projectId: string): Promise<SearchIndex> {
    const pages = await this.getProjectPages(projectId)
    const documents = new Map<string, SearchDocument>()
    const terms = new Map<string, TermInfo>()
    const fields = new Map<string, FieldInfo>()

    this.initializeDefaultFields(fields)

    for (const page of pages) {
      const doc = this.createSearchDocument(page)
      documents.set(doc.id, doc)
      this.indexDocumentTerms(doc, terms)
    }

    const metadata: SearchIndexMetadata = {
      version: '1.0.0',
      createdAt: new Date(),
      updatedAt: new Date(),
      documentCount: documents.size,
      termCount: terms.size,
      size: JSON.stringify({ documents, terms }).length,
      health: {
        status: 'green' as any,
        activeShards: 1,
        relocatingShards: 0,
        initializingShards: 0,
        unassignedShards: 0,
        validationFailures: []
      },
      statistics: this.calculateIndexStatistics(documents)
    }

    return {
      documents,
      terms,
      fields,
      metadata,
      analyzers: new Map(),
      settings: this.getDefaultSearchSettings()
    }
  }

  private createSearchDocument(page: WikiPage): SearchDocument {
    const fields = new Map<string, any>()
    fields.set('title', page.title)
    fields.set('content', page.content)
    fields.set('category', this.inferCategory(page))
    fields.set('tags', page.tags)
    fields.set('projectId', page.metadata.projectId)
    fields.set('createdAt', page.metadata.createdAt)
    fields.set('updatedAt', page.metadata.updatedAt)
    fields.set('size', page.content.length)
    fields.set('wordCount', page.content.split(/\s+/).length)
    fields.set('language', page.languageId || 'unknown')

    return {
      id: page.id,
      fields,
      metadata: {
        projectId: page.metadata.projectId,
        author: page.metadata.author,
        createdAt: page.metadata.createdAt,
        updatedAt: page.metadata.updatedAt,
        language: page.languageId || 'unknown',
        category: this.inferCategory(page),
        tags: page.tags,
        size: page.content.length,
        wordCount: page.content.split(/\s+/).length,
        readingTime: Math.ceil(page.content.split(/\s+/).length / 200),
        difficulty: DifficultyLevel.INTERMEDIATE
      },
      _boost: 1.0
    }
  }

  private indexDocumentTerms(doc: SearchDocument, terms: Map<string, TermInfo>): void {
    const content = [doc.fields.get('title'), doc.fields.get('content')].join(' ').toString().toLowerCase()
    const tokens = this.tokenizeQuery(content)

    tokens.forEach((token, position) => {
      if (!terms.has(token)) {
        terms.set(token, {
          term: token,
          field: 'content',
          frequency: 0,
          docFrequency: 0,
          totalTermFreq: 0,
          postings: [],
          positionGap: 0,
          offset: 0
        })
      }

      const termInfo = terms.get(token)!
      termInfo.frequency += 1
      termInfo.totalTermFreq += 1

      const posting = termInfo.postings.find(p => p.docId === doc.id)
      if (posting) {
        posting.positions.push(position)
        posting.termFrequency += 1
      } else {
        termInfo.postings.push({
          docId: doc.id,
          positions: [position],
          offsets: [{ start: 0, end: token.length }],
          termFrequency: 1
        })
        termInfo.docFrequency += 1
      }
    })
  }

  private initializeDefaultFields(fields: Map<string, FieldInfo>): void {
    fields.set('title', {
      name: 'title',
      type: FieldType.TEXT,
      indexed: true,
      stored: true,
      tokenized: true,
      analyzer: 'standard',
      norms: true,
      termVectors: false,
      docValues: false,
      similarity: SimilarityType.BM25,
      boost: 2.0
    })

    fields.set('content', {
      name: 'content',
      type: FieldType.TEXT,
      indexed: true,
      stored: true,
      tokenized: true,
      analyzer: 'standard',
      norms: true,
      termVectors: false,
      docValues: false,
      similarity: SimilarityType.BM25,
      boost: 1.0
    })

    fields.set('category', {
      name: 'category',
      type: FieldType.KEYWORD,
      indexed: true,
      stored: true,
      tokenized: false,
      analyzer: 'keyword',
      norms: false,
      termVectors: false,
      docValues: true,
      similarity: SimilarityType.BOOLEAN,
      boost: 1.0
    })

    fields.set('tags', {
      name: 'tags',
      type: FieldType.KEYWORD,
      indexed: true,
      stored: true,
      tokenized: false,
      analyzer: 'keyword',
      norms: false,
      termVectors: false,
      docValues: true,
      similarity: SimilarityType.BOOLEAN,
      boost: 1.0
    })
  }

  private getDefaultSearchSettings(): any {
    return {
      indexing: {
        bufferSize: 1000,
        refreshInterval: '1s',
        maxResultWindow: 10000,
        numberOfShards: 1,
        numberOfReplicas: 0,
        codec: 'default'
      },
      search: {
        defaultOperator: QueryOperator.OR,
        minimumShouldMatch: '1',
        analyzeWildcard: false,
        autoGeneratePhraseQueries: true,
        phraseSlop: 0,
        boostFactor: 1.0
      },
      analysis: {
        analyzer: new Map(),
        tokenizer: new Map(),
        filter: new Map(),
        charFilter: new Map()
      },
      performance: {
        cacheSize: 1000,
        timeout: 10000,
        maxConcurrentSearches: 10,
        slowSearchThreshold: 1000,
        enableCache: true,
        enableQueryCache: true
      }
    }
  }

  private calculateIndexStatistics(documents: Map<string, SearchDocument>): IndexStatistics {
    const docs = Array.from(documents.values())
    const totalLength = docs.reduce((sum, doc) => sum + doc.metadata.size, 0)
    const averageLength = docs.length > 0 ? totalLength / docs.length : 0

    const fieldLengths = new Map<string, number[]>()
    docs.forEach(doc => {
      doc.fields.forEach((value, key) => {
        if (!fieldLengths.has(key)) {
          fieldLengths.set(key, [])
        }
        if (typeof value === 'string') {
          fieldLengths.get(key)!.push(value.length)
        }
      })
    })

    const averageFieldLength = new Map<string, number>()
    fieldLengths.forEach((lengths, field) => {
      const sum = lengths.reduce((a, b) => a + b, 0)
      averageFieldLength.set(field, sum / lengths.length)
    })

    return {
      averageDocumentLength: averageLength,
      averageFieldLength,
      fieldCardinality: new Map(),
      termHistogram: new Map(),
      documentHistogram: new Map(),
      queryStats: {
        totalQueries: 0,
        averageQueryTime: 0,
        slowQueries: 0,
        popularQueries: this.queryStats,
        emptyResults: 0,
        errorRate: 0
      }
    }
  }

  private isIndexFresh(index: SearchIndex): boolean {
    const now = Date.now()
    const lastUpdate = index.metadata.updatedAt.getTime()
    return (now - lastUpdate) < this.config.indexRefreshInterval
  }

  private isCacheValid(result: SearchResult): boolean {
    const now = Date.now()
    const cacheTime = now - result.took
    return (now - cacheTime) < this.config.cacheTTL
  }

  private getCacheKey(projectId: string, query: SearchQuery): string {
    const key = {
      projectId,
      query: {
        text: query.text,
        filters: query.filters,
        sortBy: query.sortBy,
        limit: query.limit,
        offset: query.offset
      }
    }
    return Buffer.from(JSON.stringify(key)).toString('base64')
  }

  private updateQueryStats(query: string, resultCount: number): void {
    this.queryStats.set(query, (this.queryStats.get(query) || 0) + 1)
  }

  private tokenizeQuery(text: string): string[] {
    return text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(token => token.length > 0)
  }

  private escapeRegex(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
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

  private async findPageById(pageId: string): Promise<SearchDocument | null> {
    for (const index of this.indices.values()) {
      const doc = index.documents.get(pageId)
      if (doc) return doc
    }
    return null
  }

  private async getProjectPages(projectId: string): Promise<WikiPage[]> {
    return []
  }
}