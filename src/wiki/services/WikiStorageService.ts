import { EventEmitter } from 'events'
import type {
  WikiPage,
  WikiIndex,
  IndexEntry,
  WikiStorageConfig,
  WikiStatus
} from '../types/WikiTypes'

export class WikiStorageService extends EventEmitter {
  private storage: Map<string, WikiPage> = new Map()
  private indices: Map<string, WikiIndex> = new Map()

  constructor(config: WikiStorageConfig) {
    super()
  }

  async createWikiPage(page: WikiPage): Promise<string> {
    if (!page.id) {
      page.id = this.generateId()
    }

    if (!page.metadata.createdAt) {
      page.metadata.createdAt = new Date()
    }

    page.metadata.updatedAt = new Date()
    page.metadata.version = 1

    this.storage.set(page.id, page)

    await this.updatePageIndex(page)
    this.emit('pageCreated', page)

    return page.id
  }

  async updateWikiPage(pageId: string, updates: Partial<WikiPage>): Promise<void> {
    const existingPage = this.storage.get(pageId)
    if (!existingPage) {
      throw new Error(`Wiki page not found: ${pageId}`)
    }

    const updatedPage: WikiPage = {
      ...existingPage,
      ...updates,
      id: pageId,
      metadata: {
        ...existingPage.metadata,
        ...updates.metadata,
        updatedAt: new Date(),
        version: existingPage.metadata.version + 1
      }
    }

    this.storage.set(pageId, updatedPage)
    await this.updatePageIndex(updatedPage)
    this.emit('pageUpdated', updatedPage)
  }

  async deleteWikiPage(pageId: string): Promise<void> {
    const page = this.storage.get(pageId)
    if (!page) {
      throw new Error(`Wiki page not found: ${pageId}`)
    }

    this.storage.delete(pageId)
    await this.removeFromPageIndex(pageId, page.metadata.projectId)
    this.emit('pageDeleted', pageId)
  }

  async getWikiPage(pageId: string): Promise<WikiPage> {
    const page = this.storage.get(pageId)
    if (!page) {
      throw new Error(`Wiki page not found: ${pageId}`)
    }
    return page
  }

  async getAllWikiPages(projectId: string): Promise<WikiPage[]> {
    return Array.from(this.storage.values()).filter(
      page => page.metadata.projectId === projectId
    )
  }

  async searchWikiPages(query: string, projectId: string): Promise<WikiPage[]> {
    const projectPages = await this.getAllWikiPages(projectId)
    const index = this.indices.get(projectId)

    if (!index) {
      return this.fuzzySearch(projectPages, query)
    }

    const matchingEntries = this.searchIndex(index, query)
    const pageIds = matchingEntries.map(entry => entry.pageId)

    return projectPages.filter(page => pageIds.includes(page.id))
  }

  async getWikiIndex(projectId: string): Promise<WikiIndex> {
    let index = this.indices.get(projectId)

    if (!index) {
      index = await this.buildIndex(projectId)
      this.indices.set(projectId, index)
    }

    return index
  }

  private async buildIndex(projectId: string): Promise<WikiIndex> {
    const pages = await this.getAllWikiPages(projectId)
    const index: WikiIndex = {
      pages: new Map(),
      categories: new Map(),
      tags: new Map(),
      searchIndex: {
        documents: new Map(),
        terms: new Map(),
        metadata: {
          totalDocuments: 0,
          totalTerms: 0,
          lastUpdated: new Date(),
          version: 1
        }
      },
      metadata: {
        projectId,
        totalPages: pages.length,
        totalCategories: 0,
        totalTags: 0,
        lastUpdated: new Date(),
        version: 1
      }
    }

    for (const page of pages) {
      const entry = this.createIndexEntry(page)
      index.pages.set(page.id, entry)

      this.updateCategoryIndex(index, page)
      this.updateTagIndex(index, page)
      this.updateSearchIndex(index, page, entry)
    }

    index.metadata.totalCategories = index.categories.size
    index.metadata.totalTags = index.tags.size
    index.searchIndex.metadata.totalDocuments = index.searchIndex.documents.size
    index.searchIndex.metadata.totalTerms = index.searchIndex.terms.size

    return index
  }

  private createIndexEntry(page: WikiPage): IndexEntry {
    return {
      pageId: page.id,
      title: page.title,
      category: this.inferCategory(page),
      tags: page.tags,
      keywords: this.extractKeywords(page.content),
      excerpt: this.createExcerpt(page.content)
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

  private extractKeywords(content: string): string[] {
    const words = content.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3)

    const frequency: Record<string, number> = {}
    words.forEach(word => {
      frequency[word] = (frequency[word] || 0) + 1
    })

    return Object.entries(frequency)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([word]) => word)
  }

  private createExcerpt(content: string, maxLength: number = 200): string {
    const cleanContent = content.replace(/[#*`]/g, '').trim()
    if (cleanContent.length <= maxLength) {
      return cleanContent
    }
    return cleanContent.substring(0, maxLength) + '...'
  }

  private updateCategoryIndex(index: WikiIndex, page: WikiPage): void {
    const category = this.inferCategory(page)
    if (!index.categories.has(category)) {
      index.categories.set(category, [])
    }
    index.categories.get(category)!.push(page.id)
  }

  private updateTagIndex(index: WikiIndex, page: WikiPage): void {
    page.tags.forEach(tag => {
      if (!index.tags.has(tag)) {
        index.tags.set(tag, [])
      }
      index.tags.get(tag)!.push(page.id)
    })
  }

  private updateSearchIndex(index: WikiIndex, page: WikiPage, entry: IndexEntry): void {
    const document = {
      id: this.generateId(),
      content: page.content.toLowerCase(),
      title: page.title.toLowerCase(),
      keywords: entry.keywords,
      tokens: this.tokenize(page.content + ' ' + page.title),
      pageId: page.id
    }

    index.searchIndex.documents.set(document.id, document)

    document.tokens.forEach(token => {
      if (!index.searchIndex.terms.has(token)) {
        index.searchIndex.terms.set(token, [])
      }
      index.searchIndex.terms.get(token)!.push(document.id)
    })
  }

  private tokenize(text: string): string[] {
    return text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(token => token.length > 0)
  }

  private async updatePageIndex(page: WikiPage): Promise<void> {
    const projectId = page.metadata.projectId
    let index = this.indices.get(projectId)

    if (!index) {
      index = await this.buildIndex(projectId)
      this.indices.set(projectId, index)
    } else {
      const entry = this.createIndexEntry(page)
      index.pages.set(page.id, entry)

      this.updateCategoryIndex(index, page)
      this.updateTagIndex(index, page)

      const existingDocument = Array.from(index.searchIndex.documents.values())
        .find(doc => doc.pageId === page.id)

      if (existingDocument) {
        index.searchIndex.documents.delete(existingDocument.id)
      }

      const newEntry = index.pages.get(page.id)
      if (newEntry) {
        this.updateSearchIndex(index, page, newEntry)
      }
    }
  }

  private async removeFromPageIndex(pageId: string, projectId: string): Promise<void> {
    const index = this.indices.get(projectId)
    if (!index) return

    index.pages.delete(pageId)

    index.categories.forEach(pages => {
      const index = pages.indexOf(pageId)
      if (index > -1) {
        pages.splice(index, 1)
      }
    })

    index.tags.forEach(pages => {
      const index = pages.indexOf(pageId)
      if (index > -1) {
        pages.splice(index, 1)
      }
    })

    const document = Array.from(index.searchIndex.documents.values())
      .find(doc => doc.pageId === pageId)

    if (document) {
      index.searchIndex.documents.delete(document.id)
    }
  }

  private searchIndex(index: WikiIndex, query: string): IndexEntry[] {
    const queryTokens = this.tokenize(query.toLowerCase())
    const matchingDocuments = new Set<string>()

    queryTokens.forEach(token => {
      const documentIds = index.searchIndex.terms.get(token)
      if (documentIds) {
        documentIds.forEach(id => matchingDocuments.add(id))
      }
    })

    const matchingEntries: IndexEntry[] = []
    matchingDocuments.forEach(documentId => {
      const document = index.searchIndex.documents.get(documentId)
      if (document) {
        const entry = index.pages.get(document.pageId)
        if (entry) {
          entry.relevanceScore = this.calculateRelevance(document, queryTokens)
          matchingEntries.push(entry)
        }
      }
    })

    return matchingEntries
      .sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0))
  }

  private calculateRelevance(document: any, queryTokens: string[]): number {
    let score = 0
    queryTokens.forEach(token => {
      if (document.title.includes(token)) {
        score += 10
      }
      if (document.content.includes(token)) {
        score += 5
      }
      if (document.keywords.includes(token)) {
        score += 3
      }
    })
    return score
  }

  private fuzzySearch(pages: WikiPage[], query: string): WikiPage[] {
    const queryLower = query.toLowerCase()
    return pages
      .map(page => ({
        page,
        score: this.calculateFuzzyScore(page, queryLower)
      }))
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(item => item.page)
  }

  private calculateFuzzyScore(page: WikiPage, query: string): number {
    let score = 0
    const title = page.title.toLowerCase()
    const content = page.content.toLowerCase()

    if (title.includes(query)) score += 10
    if (content.includes(query)) score += 5

    page.tags.forEach(tag => {
      if (tag.toLowerCase().includes(query)) score += 3
    })

    return score
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2, 11)
  }

  async getPagesByStatus(projectId: string, status: WikiStatus): Promise<WikiPage[]> {
    const pages = await this.getAllWikiPages(projectId)
    return pages.filter(page => page.metadata.status === status)
  }

  async getPagesByTag(projectId: string, tag: string): Promise<WikiPage[]> {
    const pages = await this.getAllWikiPages(projectId)
    return pages.filter(page => page.tags.includes(tag))
  }

  async getPagesByCategory(projectId: string, category: string): Promise<WikiPage[]> {
    const pages = await this.getAllWikiPages(projectId)
    return pages.filter(page => this.inferCategory(page) === category)
  }

  async getRecentPages(projectId: string, limit: number = 10): Promise<WikiPage[]> {
    const pages = await this.getAllWikiPages(projectId)
    return pages
      .sort((a, b) => b.metadata.updatedAt.getTime() - a.metadata.updatedAt.getTime())
      .slice(0, limit)
  }
}