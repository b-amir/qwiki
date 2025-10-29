import { EventEmitter } from 'events'
import type { WikiPage } from '../types/WikiTypes'
import type {
  WikiLink,
  LinkAnalysis,
  LinkCluster,
  OrphanPage,
  HubPage,
  LinkStatistics,
  LinkRecommendation,
  CrossReference,
  LinkSuggestion,
  LinkGraph,
  GraphNode,
  GraphEdge,
  LinkValidationResult,
  ValidationIssue,
  ValidationSuggestion,
  ValidationIssueType,
  ValidationSeverity,
  SuggestionAction,
  LinkMetrics,
  LinkingConfig,
  LinkMetadata
} from '../types/LinkingTypes'
import {
  LinkType,
  LinkSourceType,
  OrphanReason,
  PageImportance,
  RecommendationType,
  RecommendationPriority,
  ReferenceType,
  SuggestionReason
} from '../types/LinkingTypes'

export class WikiLinkingService extends EventEmitter {
  private links: Map<string, WikiLink> = new Map()
  private crossReferences: Map<string, CrossReference> = new Map()
  private config: LinkingConfig

  constructor(config?: Partial<LinkingConfig>) {
    super()
    this.config = {
      autoLinking: true,
      minLinkStrength: 0.3,
      maxLinksPerPage: 50,
      enabledLinkTypes: Object.values(LinkType),
      suggestionThreshold: 0.5,
      validationEnabled: true,
      bidirectionalPreference: true,
      cacheEnabled: true,
      cacheTTL: 3600000, // 1 hour
      ...config
    }
  }

  async createLink(source: string, target: string, type: LinkType): Promise<void> {
    if (source === target) {
      throw new Error('Cannot create a link from a page to itself')
    }

    const existingLink = this.findLink(source, target, type)
    if (existingLink) {
      await this.updateLink(existingLink.id, { strength: Math.min(1.0, existingLink.strength + 0.1) })
      return
    }

    const link: WikiLink = {
      id: this.generateId(),
      source,
      target,
      type,
      strength: this.calculateInitialStrength(source, target, type),
      metadata: {
        sourceType: LinkSourceType.MANUAL,
        verified: false
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      bidirectional: this.config.bidirectionalPreference
    }

    this.links.set(link.id, link)

    if (this.config.bidirectionalPreference) {
      await this.createBidirectionalLink(link)
    }

    this.emit('linkCreated', link)
  }

  async deleteLink(linkId: string): Promise<void> {
    const link = this.links.get(linkId)
    if (!link) {
      throw new Error(`Link not found: ${linkId}`)
    }

    this.links.delete(linkId)

    if (link.bidirectional) {
      const reverseLink = this.findLink(link.target, link.source, link.type)
      if (reverseLink) {
        this.links.delete(reverseLink.id)
      }
    }

    this.emit('linkDeleted', linkId)
  }

  async getLinksForPage(pageId: string): Promise<WikiLink[]> {
    return Array.from(this.links.values()).filter(
      link => link.source === pageId || link.target === pageId
    )
  }

  async analyzeLinks(projectId: string): Promise<LinkAnalysis> {
    const links = Array.from(this.links.values())
    const clusters = this.identifyClusters(links)
    const orphans = await this.identifyOrphanPages(projectId)
    const hubs = await this.identifyHubPages()
    const statistics = this.calculateLinkStatistics(links)
    const recommendations = await this.generateRecommendations(links)

    return {
      links,
      clusters,
      orphans,
      hubs,
      statistics,
      recommendations
    }
  }

  async suggestLinks(pageId: string, projectId: string): Promise<WikiLink[]> {
    const suggestions: LinkSuggestion[] = []
    const existingLinks = await this.getLinksForPage(pageId)
    const existingTargets = new Set(existingLinks.map(link =>
      link.source === pageId ? link.target : link.source
    ))

    const allPages = await this.getAllPages(projectId)
    const sourcePage = allPages.find(page => page.id === pageId)

    if (!sourcePage) {
      return []
    }

    for (const targetPage of allPages) {
      if (targetPage.id === pageId || existingTargets.has(targetPage.id)) {
        continue
      }

      const suggestion = await this.analyzeLinkPotential(sourcePage, targetPage)
      if (suggestion && suggestion.confidence >= this.config.suggestionThreshold) {
        suggestions.push(suggestion)
      }
    }

    return suggestions
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 10)
      .map(suggestion => ({
        id: this.generateId(),
        source: suggestion.source,
        target: suggestion.target,
        type: suggestion.type,
        strength: suggestion.strength,
        metadata: {
          sourceType: LinkSourceType.AUTOMATIC,
          verified: false,
          confidence: suggestion.confidence,
          context: suggestion.context
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        bidirectional: false
      }))
  }

  async generateCrossReferences(projectId: string): Promise<void> {
    const pages = await this.getAllPages(projectId)
    const newReferences: CrossReference[] = []

    for (const sourcePage of pages) {
      for (const targetPage of pages) {
        if (sourcePage.id === targetPage.id) continue

        const references = this.extractCrossReferences(sourcePage, targetPage)
        newReferences.push(...references)
      }
    }

    for (const reference of newReferences) {
      this.crossReferences.set(reference.id, reference)
    }

    this.emit('crossReferencesGenerated', newReferences.length)
  }

  async getRelatedPages(pageId: string, limit?: number): Promise<string[]> {
    const links = await this.getLinksForPage(pageId)
    const relatedPages = new Map<string, number>()

    links.forEach(link => {
      const relatedId = link.source === pageId ? link.target : link.source
      const currentStrength = relatedPages.get(relatedId) || 0
      relatedPages.set(relatedId, currentStrength + link.strength)
    })

    const sorted = Array.from(relatedPages.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, limit || 10)
      .map(([pageId]) => pageId)

    return sorted
  }

  private findLink(source: string, target: string, type: LinkType): WikiLink | undefined {
    return Array.from(this.links.values()).find(
      link =>
        (link.source === source && link.target === target && link.type === type) ||
        (link.source === target && link.target === source && link.bidirectional && link.type === type)
    )
  }

  private async updateLink(linkId: string, updates: Partial<WikiLink>): Promise<void> {
    const link = this.links.get(linkId)
    if (!link) {
      throw new Error(`Link not found: ${linkId}`)
    }

    const updatedLink = {
      ...link,
      ...updates,
      updatedAt: new Date()
    }

    this.links.set(linkId, updatedLink)
    this.emit('linkUpdated', updatedLink)
  }

  private async createBidirectionalLink(originalLink: WikiLink): Promise<void> {
    const reverseLink: WikiLink = {
      ...originalLink,
      id: this.generateId(),
      source: originalLink.target,
      target: originalLink.source,
      bidirectional: false // Avoid infinite recursion
    }

    this.links.set(reverseLink.id, reverseLink)
  }

  private calculateInitialStrength(source: string, target: string, type: LinkType): number {
    const typeMultipliers = {
      [LinkType.REFERENCES]: 0.8,
      [LinkType.DEPENDS_ON]: 0.9,
      [LinkType.IMPLEMENTS]: 0.85,
      [LinkType.EXTENDS]: 0.75,
      [LinkType.SIMILAR_TO]: 0.5,
      [LinkType.RELATED_TO]: 0.4,
      [LinkType.MENTIONS]: 0.3,
      [LinkType.CITES]: 0.7,
      [LinkType.EXPLAINS]: 0.6,
      [LinkType.EXAMPLE_OF]: 0.55
    }

    return typeMultipliers[type] || 0.5
  }

  private identifyClusters(links: WikiLink[]): LinkCluster[] {
    const clusters: LinkCluster[] = []
    const visited = new Set<string>()
    const adjacencyList = this.buildAdjacencyList(links)

    for (const pageId of adjacencyList.keys()) {
      if (!visited.has(pageId)) {
        const cluster = this.findCluster(pageId, adjacencyList, visited)
        if (cluster.size > 1) {
          clusters.push(this.buildClusterInfo(cluster, links))
        }
      }
    }

    return clusters
  }

  private buildAdjacencyList(links: WikiLink[]): Map<string, Set<string>> {
    const adjacencyList = new Map<string, Set<string>>()

    links.forEach(link => {
      if (!adjacencyList.has(link.source)) {
        adjacencyList.set(link.source, new Set())
      }
      if (!adjacencyList.has(link.target)) {
        adjacencyList.set(link.target, new Set())
      }

      adjacencyList.get(link.source)!.add(link.target)
      if (link.bidirectional) {
        adjacencyList.get(link.target)!.add(link.source)
      }
    })

    return adjacencyList
  }

  private findCluster(startId: string, adjacencyList: Map<string, Set<string>>, visited: Set<string>): Set<string> {
    const cluster = new Set<string>()
    const queue = [startId]

    while (queue.length > 0) {
      const current = queue.shift()!
      if (visited.has(current)) continue

      visited.add(current)
      cluster.add(current)

      const neighbors = adjacencyList.get(current) || new Set()
      neighbors.forEach(neighbor => {
        if (!visited.has(neighbor)) {
          queue.push(neighbor)
        }
      })
    }

    return cluster
  }

  private buildClusterInfo(pageIds: Set<string>, links: WikiLink[]): LinkCluster {
    const clusterLinks = links.filter(link =>
      pageIds.has(link.source) && pageIds.has(link.target)
    )

    const centrality = this.calculateCentrality(pageIds, clusterLinks)
    const density = clusterLinks.length / (pageIds.size * (pageIds.size - 1) / 2)
    const strength = clusterLinks.reduce((sum, link) => sum + link.strength, 0) / clusterLinks.length

    return {
      id: this.generateId(),
      name: this.generateClusterName(pageIds),
      pageIds: Array.from(pageIds),
      centrality,
      density,
      strength
    }
  }

  private calculateCentrality(pageIds: Set<string>, links: WikiLink[]): number {
    const connections = new Map<string, number>()

    pageIds.forEach(pageId => {
      connections.set(pageId, 0)
    })

    links.forEach(link => {
      connections.set(link.source, (connections.get(link.source) || 0) + 1)
      connections.set(link.target, (connections.get(link.target) || 0) + 1)
    })

    const totalConnections = Array.from(connections.values()).reduce((sum, count) => sum + count, 0)
    return totalConnections / pageIds.size
  }

  private generateClusterName(pageIds: Set<string>): string {
    return `Cluster-${Array.from(pageIds).slice(0, 3).join('-')}`
  }

  private async identifyOrphanPages(projectId: string): Promise<OrphanPage[]> {
    const allPages = await this.getAllPages(projectId)
    const orphans: OrphanPage[] = []

    for (const page of allPages) {
      const links = await this.getLinksForPage(page.id)
      const incomingLinks = links.filter(link => link.target === page.id)
      const outgoingLinks = links.filter(link => link.source === page.id)

      let reason: OrphanReason | null = null
      const suggestions: string[] = []

      if (incomingLinks.length === 0 && outgoingLinks.length === 0) {
        reason = OrphanReason.ISOLATED_TOPIC
        suggestions.push('Add links to related pages', 'Create references from other pages')
      } else if (incomingLinks.length === 0) {
        reason = OrphanReason.NO_INCOMING_LINKS
        suggestions.push('Create links from related pages to this page')
      } else if (outgoingLinks.length === 0) {
        reason = OrphanReason.NO_OUTGOING_LINKS
        suggestions.push('Add links to related pages')
      }

      if (reason) {
        orphans.push({
          pageId: page.id,
          title: page.title,
          reason,
          suggestions
        })
      }
    }

    return orphans
  }

  private async identifyHubPages(): Promise<HubPage[]> {
    const linkCounts = new Map<string, number>()
    const centralityScores = new Map<string, number>()

    this.links.forEach(link => {
      linkCounts.set(link.source, (linkCounts.get(link.source) || 0) + 1)
      linkCounts.set(link.target, (linkCounts.get(link.target) || 0) + 1)
    })

    linkCounts.forEach((count, pageId) => {
      const totalLinks = this.links.size
      const centrality = count / totalLinks
      centralityScores.set(pageId, centrality)
    })

    const hubs: HubPage[] = []
    const sortedPages = Array.from(centralityScores.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)

    for (const [pageId, centrality] of sortedPages) {
      if (centrality > 0.1) {
        const importance = this.calculatePageImportance(centrality)
        hubs.push({
          pageId,
          title: await this.getPageTitle(pageId),
          linkCount: linkCounts.get(pageId) || 0,
          centralityScore: centrality,
          importance
        })
      }
    }

    return hubs
  }

  private calculatePageImportance(centrality: number): PageImportance {
    if (centrality > 0.3) return PageImportance.CRITICAL
    if (centrality > 0.2) return PageImportance.HIGH
    if (centrality > 0.1) return PageImportance.MEDIUM
    return PageImportance.LOW
  }

  private calculateLinkStatistics(links: WikiLink[]): LinkStatistics {
    const linkDistribution = new Map<LinkType, number>()
    const pageLinkCounts = new Map<string, number>()

    links.forEach(link => {
      linkDistribution.set(link.type, (linkDistribution.get(link.type) || 0) + 1)
      pageLinkCounts.set(link.source, (pageLinkCounts.get(link.source) || 0) + 1)
      pageLinkCounts.set(link.target, (pageLinkCounts.get(link.target) || 0) + 1)
    })

    const sortedLinks = [...links].sort((a, b) => b.strength - a.strength)
    const sortedPages = Array.from(pageLinkCounts.entries())
      .sort(([, a], [, b]) => b - a)

    const averageLinksPerPage = pageLinkCounts.size > 0
      ? Array.from(pageLinkCounts.values()).reduce((sum, count) => sum + count, 0) / pageLinkCounts.size
      : 0

    const linkDensity = this.calculateLinkDensity(links)
    const clusteringCoefficient = this.calculateClusteringCoefficient(links)

    return {
      totalLinks: links.length,
      averageLinksPerPage,
      linkDistribution,
      strongestLinks: sortedLinks.slice(0, 5),
      weakestLinks: sortedLinks.slice(-5),
      mostConnectedPages: sortedPages.slice(0, 10).map(([pageId]) => pageId),
      leastConnectedPages: sortedPages.slice(-10).map(([pageId]) => pageId),
      linkDensity,
      clusteringCoefficient
    }
  }

  private calculateLinkDensity(links: WikiLink[]): number {
    const uniquePages = new Set<string>()
    links.forEach(link => {
      uniquePages.add(link.source)
      uniquePages.add(link.target)
    })

    const maxPossibleLinks = uniquePages.size * (uniquePages.size - 1) / 2
    return maxPossibleLinks > 0 ? links.length / maxPossibleLinks : 0
  }

  private calculateClusteringCoefficient(links: WikiLink[]): number {
    const adjacencyList = this.buildAdjacencyList(links)
    let totalClustering = 0
    let nodeCount = 0

    for (const [node, neighbors] of adjacencyList) {
      if (neighbors.size < 2) continue

      let existingEdges = 0
      const neighborArray = Array.from(neighbors)

      for (let i = 0; i < neighborArray.length; i++) {
        for (let j = i + 1; j < neighborArray.length; j++) {
          if (adjacencyList.get(neighborArray[i])?.has(neighborArray[j])) {
            existingEdges++
          }
        }
      }

      const possibleEdges = neighbors.size * (neighbors.size - 1) / 2
      totalClustering += possibleEdges > 0 ? existingEdges / possibleEdges : 0
      nodeCount++
    }

    return nodeCount > 0 ? totalClustering / nodeCount : 0
  }

  private async generateRecommendations(links: WikiLink[]): Promise<LinkRecommendation[]> {
    const recommendations: LinkRecommendation[] = []

    const weakLinks = links.filter(link => link.strength < this.config.minLinkStrength)
    weakLinks.forEach(link => {
      recommendations.push({
        type: RecommendationType.STRENGTHEN_LINK,
        source: link.source,
        target: link.target,
        reason: `Link strength is low (${link.strength.toFixed(2)})`,
        confidence: 0.8,
        priority: RecommendationPriority.MEDIUM,
        suggestedLinkType: link.type
      })
    })

    const pages = Array.from(new Set(links.flatMap(link => [link.source, link.target])))
    for (const pageId of pages) {
      const pageLinks = links.filter(link => link.source === pageId || link.target === pageId)
      if (pageLinks.length > this.config.maxLinksPerPage) {
        recommendations.push({
          type: RecommendationType.REMOVE_LINK,
          source: pageId,
          target: '',
          reason: `Page has too many links (${pageLinks.length})`,
          confidence: 0.9,
          priority: RecommendationPriority.HIGH,
          suggestedLinkType: LinkType.RELATED_TO
        })
      }
    }

    return recommendations
  }

  private async analyzeLinkPotential(sourcePage: WikiPage, targetPage: WikiPage): Promise<LinkSuggestion | null> {
    const contentSimilarity = this.calculateContentSimilarity(sourcePage.content, targetPage.content)
    const tagSimilarity = this.calculateTagSimilarity(sourcePage.tags, targetPage.tags)
    const keywordOverlap = this.calculateKeywordOverlap(sourcePage.content, targetPage.content)

    const overallSimilarity = (contentSimilarity * 0.5) + (tagSimilarity * 0.3) + (keywordOverlap * 0.2)

    if (overallSimilarity < this.config.suggestionThreshold) {
      return null
    }

    let linkType = LinkType.RELATED_TO
    let reason = SuggestionReason.CONTENT_SIMILARITY

    if (keywordOverlap > 0.8) {
      linkType = LinkType.SIMILAR_TO
      reason = SuggestionReason.SHARED_KEYWORDS
    } else if (contentSimilarity > 0.7) {
      linkType = LinkType.REFERENCES
      reason = SuggestionReason.SEMANTIC_RELATIONSHIP
    }

    return {
      source: sourcePage.id,
      target: targetPage.id,
      type: linkType,
      strength: overallSimilarity,
      reason,
      confidence: overallSimilarity,
      context: this.extractCommonContext(sourcePage.content, targetPage.content)
    }
  }

  private calculateContentSimilarity(content1: string, content2: string): number {
    const words1 = this.tokenize(content1.toLowerCase())
    const words2 = this.tokenize(content2.toLowerCase())

    const intersection = new Set(words1.filter(word => words2.includes(word)))
    const union = new Set([...words1, ...words2])

    return union.size > 0 ? intersection.size / union.size : 0
  }

  private calculateTagSimilarity(tags1: string[], tags2: string[]): number {
    const set1 = new Set(tags1.map(tag => tag.toLowerCase()))
    const set2 = new Set(tags2.map(tag => tag.toLowerCase()))

    const intersection = new Set([...set1].filter(tag => set2.has(tag)))
    const union = new Set([...set1, ...set2])

    return union.size > 0 ? intersection.size / union.size : 0
  }

  private calculateKeywordOverlap(content1: string, content2: string): number {
    const keywords1 = this.extractKeywords(content1)
    const keywords2 = this.extractKeywords(content2)

    const intersection = new Set(keywords1.filter(keyword => keywords2.includes(keyword)))
    const union = new Set([...keywords1, ...keywords2])

    return union.size > 0 ? intersection.size / union.size : 0
  }

  private tokenize(text: string): string[] {
    return text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2)
  }

  private extractKeywords(content: string): string[] {
    const words = this.tokenize(content)
    const frequency = new Map<string, number>()

    words.forEach(word => {
      frequency.set(word, (frequency.get(word) || 0) + 1)
    })

    return Array.from(frequency.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 20)
      .map(([word]) => word)
  }

  private extractCommonContext(content1: string, content2: string): string {
    const words1 = this.tokenize(content1)
    const words2 = this.tokenize(content2)

    const commonWords = words1.filter(word => words2.includes(word)).slice(0, 5)
    return commonWords.join(', ')
  }

  private extractCrossReferences(sourcePage: WikiPage, targetPage: WikiPage): CrossReference[] {
    const references: CrossReference[] = []
    const sourceWords = this.tokenize(sourcePage.content)
    const targetWords = this.tokenize(targetPage.content)

    const targetKeywords = this.extractKeywords(targetPage.content)
    const matches = targetKeywords.filter(keyword => sourceWords.includes(keyword))

    if (matches.length > 0) {
      references.push({
        id: this.generateId(),
        sourcePageId: sourcePage.id,
        referenceType: ReferenceType.MENTION,
        targetContent: matches.slice(0, 3).join(', '),
        context: this.extractContextAroundKeywords(sourcePage.content, matches),
        strength: matches.length / targetKeywords.length,
        metadata: {
          createdAt: new Date(),
          verified: false,
          tags: targetPage.tags,
          relatedTopics: [targetPage.title]
        }
      })
    }

    return references
  }

  private extractContextAroundKeywords(content: string, keywords: string[]): string {
    const sentences = content.split(/[.!?]+/)
    const relevantSentences = sentences.filter(sentence =>
      keywords.some(keyword => sentence.toLowerCase().includes(keyword))
    )

    return relevantSentences.slice(0, 2).join('. ')
  }

  private async getAllPages(projectId: string): Promise<WikiPage[]> {
    return []
  }

  private async getPageTitle(pageId: string): Promise<string> {
    return `Page-${pageId}`
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2, 11)
  }
}