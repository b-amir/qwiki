import { EventEmitter } from 'events'
import type { WikiPage } from '../types/WikiTypes'
import type {
  WikiVersion,
  VersionMetadata,
  ComplexityMetrics,
  ComplexityFactor,
  SectionInfo,
  LinkInfo,
  ImageInfo,
  CodeBlockInfo,
  VersionDiff,
  DiffSummary,
  DiffSection,
  DiffChange,
  DiffStatistics,
  DiffHunk,
  VersionHistory,
  TimelineEntry,
  HistoryStatistics,
  AuthorActivity,
  MonthlyActivity,
  BranchInfo,
  VersionTag,
  VersionComparison,
  ComparisonSummary,
  DetailedDiff,
  ComparisonStatistics,
  ComparisonInsight,
  VersionConflict,
  Conflict,
  ConflictContent,
  ConflictSuggestion,
  ConflictResolution,
  VersioningConfig
} from '../types/VersioningTypes'
import {
  ContentType,
  FactorType,
  LinkType,
  DiffType,
  SectionDiffType,
  ChangeType,
  ChangeSignificance,
  TimelineEntryType,
  AuthorRole,
  ComparisonSignificance,
  RiskLevel,
  InsightType,
  InsightSeverity,
  ConflictType,
  ConflictSeverity,
  SuggestionType,
  ConflictStatus,
  ResolutionStrategy,
  DiffAlgorithm
} from '../types/VersioningTypes'

export class WikiVersioningService extends EventEmitter {
  private versions: Map<string, WikiVersion> = new Map()
  private histories: Map<string, VersionHistory> = new Map()
  private conflicts: Map<string, VersionConflict> = new Map()
  private config: VersioningConfig

  constructor(config?: Partial<VersioningConfig>) {
    super()
    this.config = {
      maxVersionsPerPage: 100,
      autoSaveInterval: 300000, // 5 minutes
      compressionEnabled: true,
      retentionPeriod: 365 * 24 * 60 * 60 * 1000, // 1 year
      enableBranching: true,
      enableTagging: true,
      enableConflictDetection: true,
      diffAlgorithm: DiffAlgorithm.MYERS,
      similarityThreshold: 0.8,
      autoMergeEnabled: false
    }
  }

  async createVersion(pageId: string, content: string, changelog: string, author: string): Promise<string> {
    const existingHistory = this.getHistory(pageId)
    const latestVersion = existingHistory.versions[0]
    const newVersionNumber = this.calculateNextVersion(latestVersion?.version)
    const versionId = this.generateId()

    const title = this.extractTitle(content)
    const metadata = await this.analyzeContent(content, pageId)
    const differences = latestVersion ? await this.calculateDifferences(latestVersion.content, content) : this.createInitialDiff(content)

    const version: WikiVersion = {
      id: versionId,
      pageId,
      version: newVersionNumber,
      content,
      title,
      author,
      timestamp: new Date(),
      changelog,
      tags: this.extractTags(content),
      metadata,
      differences,
      parentVersion: latestVersion?.id,
      childVersions: [],
      branch: 'main',
      isDeleted: false
    }

    this.versions.set(versionId, version)

    if (latestVersion) {
      latestVersion.childVersions.push(versionId)
    }

    await this.updateHistory(pageId, version)
    this.cleanupOldVersions(pageId)

    this.emit('versionCreated', { pageId, version })
    return versionId
  }

  async getVersions(pageId: string): Promise<WikiVersion[]> {
    const history = this.getHistory(pageId)
    return history.versions.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  }

  async getVersion(pageId: string, versionId: string): Promise<WikiVersion> {
    const version = this.versions.get(versionId)
    if (!version || version.pageId !== pageId) {
      throw new Error(`Version ${versionId} not found for page ${pageId}`)
    }
    return version
  }

  async revertToVersion(pageId: string, versionId: string): Promise<void> {
    const version = await this.getVersion(pageId, versionId)
    const currentHistory = this.getHistory(pageId)
    const currentVersion = currentHistory.versions[0]

    const revertVersion = await this.createVersion(
      pageId,
      version.content,
      `Revert to version ${version.version}`,
      currentVersion.author
    )

    this.emit('versionReverted', { pageId, versionId, revertVersion })
  }

  async compareVersions(pageId: string, versionId1: string, versionId2: string): Promise<VersionComparison> {
    const version1 = await this.getVersion(pageId, versionId1)
    const version2 = await this.getVersion(pageId, versionId2)

    const differences = await this.calculateDetailedDifferences(version1.content, version2.content)
    const statistics = this.calculateComparisonStatistics(version1, version2, differences)
    const insights = await this.generateComparisonInsights(version1, version2, differences)

    const similarity = this.calculateSimilarity(version1.content, version2.content)
    const significance = this.determineComparisonSignificance(similarity, statistics.totalChanges)

    const summary: ComparisonSummary = {
      similarity,
      differences: statistics.totalChanges,
      significance,
      recommendation: this.generateComparisonRecommendation(significance, similarity),
      riskLevel: this.determineRiskLevel(significance, insights)
    }

    return {
      fromVersion: versionId1,
      toVersion: versionId2,
      summary,
      differences,
      statistics,
      insights
    }
  }

  async getVersionHistory(pageId: string): Promise<VersionHistory> {
    return this.getHistory(pageId)
  }

  async detectConflicts(pageId: string, baseVersionId: string, incomingVersions: string[]): Promise<VersionConflict[]> {
    const conflicts: VersionConflict[] = []
    const baseVersion = await this.getVersion(pageId, baseVersionId)

    for (const incomingVersionId of incomingVersions) {
      const incomingVersion = await this.getVersion(pageId, incomingVersionId)
      const pageConflicts = await this.detectPageConflicts(baseVersion, incomingVersion)

      if (pageConflicts.length > 0) {
        const conflict: VersionConflict = {
          id: this.generateId(),
          pageId,
          baseVersion: baseVersionId,
          conflictingVersions: [incomingVersionId],
          conflicts: pageConflicts,
          status: ConflictStatus.PENDING,
          createdAt: new Date()
        }

        this.conflicts.set(conflict.id, conflict)
        conflicts.push(conflict)
      }
    }

    return conflicts
  }

  async resolveConflict(conflictId: string, resolution: ConflictResolution): Promise<void> {
    const conflict = this.conflicts.get(conflictId)
    if (!conflict) {
      throw new Error(`Conflict ${conflictId} not found`)
    }

    conflict.resolution = resolution
    conflict.status = ConflictStatus.RESOLVED
    conflict.resolvedAt = new Date()
    conflict.resolvedBy = resolution.reviewer

    this.emit('conflictResolved', { conflictId, resolution })
  }

  async createBranch(pageId: string, branchName: string, versionId: string, createdBy: string): Promise<BranchInfo> {
    const history = this.getHistory(pageId)
    const baseVersion = await this.getVersion(pageId, versionId)

    const branch: BranchInfo = {
      name: branchName,
      headVersion: versionId,
      baseVersion: versionId,
      createdAt: new Date(),
      createdBy,
      isMain: false,
      isProtected: false,
      description: `Branch created from version ${baseVersion.version}`
    }

    history.branches.push(branch)
    this.emit('branchCreated', { pageId, branch })

    return branch
  }

  async tagVersion(pageId: string, versionId: string, tagName: string, description: string, createdBy: string): Promise<VersionTag> {
    const version = await this.getVersion(pageId, versionId)
    const history = this.getHistory(pageId)

    const tag: VersionTag = {
      name: tagName,
      version: versionId,
      createdAt: new Date(),
      createdBy,
      description,
      isStable: true
    }

    history.tags.push(tag)
    this.emit('versionTagged', { pageId, versionId, tag })

    return tag
  }

  private getHistory(pageId: string): VersionHistory {
    let history = this.histories.get(pageId)

    if (!history) {
      history = {
        pageId,
        versions: [],
        timeline: [],
        statistics: this.createEmptyStatistics(),
        branches: [],
        tags: []
      }
      this.histories.set(pageId, history)
    }

    return history
  }

  private async updateHistory(pageId: string, version: WikiVersion): Promise<void> {
    const history = this.getHistory(pageId)
    history.versions.unshift(version)

    const timelineEntry: TimelineEntry = {
      version: version.version,
      timestamp: version.timestamp,
      author: version.author,
      type: version.parentVersion ? TimelineEntryType.UPDATED : TimelineEntryType.CREATED,
      description: version.changelog,
      changes: version.differences.summary.totalChanges,
      significance: version.differences.summary.type === DiffType.ADDITION ? ChangeSignificance.MAJOR : ChangeSignificance.MODERATE
    }

    history.timeline.unshift(timelineEntry)
    history.statistics = this.calculateHistoryStatistics(history)
  }

  private calculateNextVersion(latestVersion?: string): string {
    if (!latestVersion) {
      return '1.0.0'
    }

    const parts = latestVersion.split('.').map(Number)
    if (parts.length === 3) {
      if (parts[2] < 99) {
        parts[2]++
      } else if (parts[1] < 99) {
        parts[1]++
        parts[2] = 0
      } else if (parts[0] < 99) {
        parts[0]++
        parts[1] = 0
        parts[2] = 0
      }
    }

    return parts.join('.')
  }

  private async analyzeContent(content: string, pageId: string): Promise<VersionMetadata> {
    const wordCount = this.countWords(content)
    const characterCount = content.length
    const readingTime = Math.ceil(wordCount / 200)
    const complexity = await this.calculateComplexity(content)
    const sections = this.extractSections(content)
    const links = this.extractLinks(content)
    const images = this.extractImages(content)
    const codeBlocks = this.extractCodeBlocks(content)
    const checksum = this.calculateChecksum(content)

    return {
      wordCount,
      characterCount,
      readingTime,
      complexity,
      sections,
      links,
      images,
      codeBlocks,
      checksum,
      contentType: this.detectContentType(content),
      language: this.detectLanguage(content),
      lastModified: new Date()
    }
  }

  private async calculateComplexity(content: string): Promise<ComplexityMetrics> {
    const readabilityScore = this.calculateReadabilityScore(content)
    const technicalComplexity = this.calculateTechnicalComplexity(content)
    const structuralComplexity = this.calculateStructuralComplexity(content)

    const factors: ComplexityFactor[] = [
      {
        type: FactorType.READABILITY,
        score: readabilityScore,
        description: 'Text readability based on sentence length and vocabulary',
        impact: readabilityScore > 0.7 ? 'Easy to read' : 'May be difficult to read'
      },
      {
        type: FactorType.TECHNICAL,
        score: technicalComplexity,
        description: 'Technical terminology and code complexity',
        impact: technicalComplexity > 0.6 ? 'High technical content' : 'Low technical content'
      },
      {
        type: FactorType.STRUCTURAL,
        score: structuralComplexity,
        description: 'Document structure and organization',
        impact: structuralComplexity > 0.5 ? 'Well structured' : 'Poorly structured'
      }
    ]

    const overallComplexity = (readabilityScore + technicalComplexity + structuralComplexity) / 3

    return {
      readabilityScore,
      technicalComplexity,
      structuralComplexity,
      overallComplexity,
      factors
    }
  }

  private calculateReadabilityScore(content: string): number {
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0)
    const words = content.split(/\s+/).filter(w => w.length > 0)

    if (sentences.length === 0 || words.length === 0) return 0

    const averageSentenceLength = words.length / sentences.length
    const complexWords = words.filter(word => word.length > 6).length
    const complexWordRatio = complexWords / words.length

    const readabilityScore = Math.max(0, 1 - (averageSentenceLength / 50) - (complexWordRatio * 2))
    return Math.min(1, readabilityScore)
  }

  private calculateTechnicalComplexity(content: string): number {
    const technicalTerms = this.extractTechnicalTerms(content)
    const codeBlocks = (content.match(/```[\s\S]*?```/g) || []).length
    const codeSnippets = (content.match(/`[^`]+`/g) || []).length

    const technicalDensity = (technicalTerms.length + codeBlocks * 2 + codeSnippets) / content.length
    return Math.min(1, technicalDensity * 10)
  }

  private calculateStructuralComplexity(content: string): number {
    const headers = (content.match(/^#+\s+.+$/gm) || []).length
    const lists = (content.match(/^\s*[-*+]\s+/gm) || []).length
    const codeBlocks = (content.match(/```[\s\S]*?```/g) || []).length

    const structureScore = (headers + lists + codeBlocks * 2) / 10
    return Math.min(1, structureScore)
  }

  private extractTechnicalTerms(content: string): string[] {
    const commonTechnicalTerms = [
      'function', 'class', 'interface', 'method', 'variable', 'constant',
      'algorithm', 'implementation', 'optimization', 'performance',
      'architecture', 'design', 'pattern', 'framework', 'library',
      'database', 'api', 'endpoint', 'service', 'component', 'module'
    ]

    return commonTechnicalTerms.filter(term =>
      content.toLowerCase().includes(term.toLowerCase())
    )
  }

  private extractSections(content: string): SectionInfo[] {
    const sections: SectionInfo[] = []
    const lines = content.split('\n')

    lines.forEach((line, index) => {
      const headerMatch = line.match(/^(#{1,6})\s+(.+)$/)
      if (headerMatch) {
        const level = headerMatch[1].length
        const title = headerMatch[2].trim()
        const position = index

        sections.push({
          id: this.generateId(),
          title,
          level,
          wordCount: line.split(/\s+/).length,
          position,
          subsections: []
        })
      }
    })

    return sections
  }

  private extractLinks(content: string): LinkInfo[] {
    const links: LinkInfo[] = []
    const markdownLinks = content.match(/\[([^\]]+)\]\(([^)]+)\)/g) || []

    markdownLinks.forEach(match => {
      const text = match[1]
      const url = match[2]

      links.push({
        url,
        text,
        type: this.determineLinkType(url),
        isValid: this.isValidUrl(url),
        targetPage: url.startsWith('/') ? url.substring(1) : undefined
      })
    })

    return links
  }

  private extractImages(content: string): ImageInfo[] {
    const images: ImageInfo[] = []
    const markdownImages = content.match(/!\[([^\]]*)\]\(([^)]+)\)/g) || []

    markdownImages.forEach(match => {
      const alt = match[1]
      const src = match[2]

      images.push({
        src,
        alt,
        size: src.length,
      })
    })

    return images
  }

  private extractCodeBlocks(content: string): CodeBlockInfo[] {
    const codeBlocks: CodeBlockInfo[] = []
    const blocks = content.match(/```(\w+)?\n([\s\S]*?)```/g) || []

    blocks.forEach(block => {
      const match = block.match(/```(\w+)?\n([\s\S]*?)```/)
      if (match) {
        const language = match[1] || 'text'
        const code = match[2]

        codeBlocks.push({
          language,
          lineCount: code.split('\n').length,
          complexity: this.calculateCodeComplexity(code),
          dependencies: this.extractCodeDependencies(code),
          functions: this.extractCodeFunctions(code)
        })
      }
    })

    return codeBlocks
  }

  private calculateCodeComplexity(code: string): number {
    const lines = code.split('\n')
    const complexity = lines.reduce((score, line) => {
      let lineScore = 1

      if (line.includes('if') || line.includes('for') || line.includes('while')) lineScore += 2
      if (line.includes('function') || line.includes('class')) lineScore += 3
      if (line.includes('try') || line.includes('catch')) lineScore += 2
      if (line.includes('=>')) lineScore += 1

      return score + lineScore
    }, 0)

    return Math.min(1, complexity / (lines.length * 2))
  }

  private extractCodeDependencies(code: string): string[] {
    const imports = code.match(/import\s+.*from\s+['"`]([^'"`]+)['"`]/g) || []
    return imports.map(imp => imp.match(/from\s+['"`]([^'"`]+)['"`]/)?.[1] || '').filter(Boolean)
  }

  private extractCodeFunctions(code: string): string[] {
    const functions = code.match(/(?:function\s+(\w+)|(\w+)\s*=\s*(?:function|\([^)]*\)\s*=>))/g) || []
    return functions.map(func => {
      const match = func.match(/(?:function\s+(\w+)|(\w+)\s*=)/)
      return match?.[1] || match?.[2] || ''
    }).filter(Boolean)
  }

  private async calculateDifferences(oldContent: string, newContent: string): Promise<VersionDiff> {
    const summary = this.calculateDiffSummary(oldContent, newContent)
    const sections = this.calculateDiffSections(oldContent, newContent)
    const statistics = this.calculateDiffStatistics(oldContent, newContent)
    const hunks = this.calculateDiffHunks(oldContent, newContent)

    return {
      summary,
      sections,
      statistics,
      hunks
    }
  }

  private calculateDiffSummary(oldContent: string, newContent: string): DiffSummary {
    const oldLines = oldContent.split('\n')
    const newLines = newContent.split('\n')
    const similarity = this.calculateSimilarity(oldContent, newContent)

    return {
      additions: newLines.length - oldLines.length,
      deletions: Math.max(0, oldLines.length - newLines.length),
      modifications: Math.min(oldLines.length, newLines.length),
      totalChanges: Math.abs(oldLines.length - newLines.length) + Math.min(oldLines.length, newLines.length),
      similarity,
      type: similarity > 0.9 ? DiffType.MODIFICATION : similarity > 0.5 ? DiffType.ADDITION : DiffType.DELETION
    }
  }

  private calculateDiffSections(oldContent: string, newContent: string): DiffSection[] {
    const sections: DiffSection[] = []

    if (oldContent !== newContent) {
      sections.push({
        id: this.generateId(),
        title: 'Content Changes',
        type: SectionDiffType.CONTENT,
        changes: [{
          type: ChangeType.REPLACE,
          content: newContent,
          position: 0,
          oldContent,
          newContent,
          context: [],
          significance: 2
        }],
        significance: ChangeSignificance.MODERATE
      })
    }

    return sections
  }

  private calculateDiffStatistics(oldContent: string, newContent: string): DiffStatistics {
    const oldLines = oldContent.split('\n')
    const newLines = newContent.split('\n')

    const linesAdded = Math.max(0, newLines.length - oldLines.length)
    const linesRemoved = Math.max(0, oldLines.length - newLines.length)
    const linesModified = Math.min(oldLines.length, newLines.length)
    const wordsAdded = this.countWords(newContent) - this.countWords(oldContent)
    const wordsRemoved = Math.max(0, this.countWords(oldContent) - this.countWords(newContent))
    const charactersAdded = newContent.length - oldContent.length
    const charactersRemoved = Math.max(0, oldContent.length - newContent.length)

    return {
      linesAdded,
      linesRemoved,
      linesModified,
      sectionsAdded: 0,
      sectionsRemoved: 0,
      sectionsModified: 1,
      wordsAdded,
      wordsRemoved,
      charactersAdded,
      charactersRemoved,
      totalChanges: linesAdded + linesRemoved + linesModified
    }
  }

  private calculateDiffHunks(oldContent: string, newContent: string): DiffHunk[] {
    return [{
      id: this.generateId(),
      oldStart: 1,
      oldLines: oldContent.split('\n').length,
      newStart: 1,
      newLines: newContent.split('\n').length,
      changes: [],
      context: []
    }]
  }

  private createInitialDiff(content: string): VersionDiff {
    const lines = content.split('\n')

    return {
      summary: {
        additions: lines.length,
        deletions: 0,
        modifications: 0,
        totalChanges: lines.length,
        similarity: 1.0,
        type: DiffType.ADDITION
      },
      sections: [{
        id: this.generateId(),
        title: 'Initial Content',
        type: SectionDiffType.CONTENT,
        changes: [{
          type: ChangeType.INSERT,
          content,
          position: 0,
          newContent: content,
          context: [],
          significance: 3
        }],
        significance: ChangeSignificance.MAJOR
      }],
      statistics: {
        linesAdded: lines.length,
        linesRemoved: 0,
        linesModified: 0,
        sectionsAdded: 1,
        sectionsRemoved: 0,
        sectionsModified: 0,
        wordsAdded: this.countWords(content),
        wordsRemoved: 0,
        charactersAdded: content.length,
        charactersRemoved: 0,
        totalChanges: lines.length
      },
      hunks: [{
        id: this.generateId(),
        oldStart: 0,
        oldLines: 0,
        newStart: 1,
        newLines: lines.length,
        changes: [{
          type: ChangeType.INSERT,
          content,
          position: 0,
          newContent: content,
          context: [],
          significance: 1
        }],
        context: []
      }]
    }
  }

  private createEmptyStatistics(): HistoryStatistics {
    return {
      totalVersions: 0,
      totalAuthors: 0,
      averageChangesPerVersion: 0,
      mostActiveAuthor: '',
      averageTimeBetweenVersions: 0,
      growthRate: 0,
      activityByAuthor: new Map(),
      activityByMonth: new Map()
    }
  }

  private calculateHistoryStatistics(history: VersionHistory): HistoryStatistics {
    const versions = history.versions
    const authors = new Set(versions.map(v => v.author))
    const authorActivity = new Map<string, AuthorActivity>()
    const activityByMonth = new Map<string, MonthlyActivity>()

    versions.forEach(version => {
      const monthKey = version.timestamp.toISOString().substring(0, 7)

      if (!authorActivity.has(version.author)) {
        authorActivity.set(version.author, {
          versions: 0,
          additions: 0,
          deletions: 0,
          lastContribution: version.timestamp,
          role: AuthorRole.AUTHOR
        })
      }

      const activity = authorActivity.get(version.author)!
      activity.versions++
      activity.additions += version.differences.statistics.linesAdded
      activity.deletions += version.differences.statistics.linesRemoved
      activity.lastContribution = version.timestamp

      if (!activityByMonth.has(monthKey)) {
        activityByMonth.set(monthKey, {
          versions: 0,
          authors: 0,
          changes: 0,
          growthRate: 0
        })
      }

      const monthlyActivity = activityByMonth.get(monthKey)!
      monthlyActivity.versions++
      monthlyActivity.authors += 1
      monthlyActivity.changes += version.differences.statistics.totalChanges
    })

    const totalChanges = versions.reduce((sum, v) => sum + v.differences.statistics.totalChanges, 0)
    const averageChangesPerVersion = versions.length > 0 ? totalChanges / versions.length : 0

    return {
      totalVersions: versions.length,
      totalAuthors: authors.size,
      averageChangesPerVersion,
      mostActiveAuthor: this.findMostActiveAuthor(authorActivity),
      averageTimeBetweenVersions: this.calculateAverageTimeBetweenVersions(versions),
      growthRate: this.calculateGrowthRate(versions),
      activityByAuthor: authorActivity,
      activityByMonth: activityByMonth
    }
  }

  private findMostActiveAuthor(authorActivity: Map<string, AuthorActivity>): string {
    let maxVersions = 0
    let mostActive = ''

    authorActivity.forEach((activity, author) => {
      if (activity.versions > maxVersions) {
        maxVersions = activity.versions
        mostActive = author
      }
    })

    return mostActive
  }

  private calculateAverageTimeBetweenVersions(versions: WikiVersion[]): number {
    if (versions.length < 2) return 0

    const timeDifferences = []
    for (let i = 1; i < versions.length; i++) {
      const diff = versions[i - 1].timestamp.getTime() - versions[i].timestamp.getTime()
      timeDifferences.push(diff)
    }

    const total = timeDifferences.reduce((sum, diff) => sum + diff, 0)
    return total / timeDifferences.length
  }

  private calculateGrowthRate(versions: WikiVersion[]): number {
    if (versions.length < 2) return 0

    const firstVersion = versions[versions.length - 1]
    const latestVersion = versions[0]
    const timeDiff = latestVersion.timestamp.getTime() - firstVersion.timestamp.getTime()
    const versionDiff = this.parseVersionNumber(latestVersion.version) - this.parseVersionNumber(firstVersion.version)

    return timeDiff > 0 ? (versionDiff / timeDiff) * 1000 * 60 * 60 * 24 * 30 : 0
  }

  private parseVersionNumber(version: string): number {
    const parts = version.split('.').map(Number)
    return parts[0] * 10000 + parts[1] * 100 + parts[2]
  }

  private async calculateDetailedDifferences(oldContent: string, newContent: string): Promise<DetailedDiff[]> {
    const differences: DetailedDiff[] = []

    if (oldContent !== newContent) {
      differences.push({
        section: 'Content',
        type: DiffType.MODIFICATION,
        changes: [{
          type: ChangeType.REPLACE,
          position: 0,
          content: newContent,
          oldContent,
          newContent,
          context: [],
          significance: 2
        }],
        impact: 'Content has been modified',
        suggestions: ['Review changes for accuracy']
      })
    }

    return differences
  }

  private calculateComparisonStatistics(version1: WikiVersion, version2: WikiVersion, differences: DetailedDiff[]): ComparisonStatistics {
    const unchangedLines = Math.max(0, Math.min(version1.content.split('\n').length, version2.content.split('\n').length))
    const totalChanges = differences.reduce((sum, diff) => sum + diff.changes.length, 0)
    const addedLines = differences.reduce((sum, diff) =>
      sum + diff.changes.filter(c => c.type === ChangeType.INSERT).length, 0
    )
    const removedLines = differences.reduce((sum, diff) =>
      sum + diff.changes.filter(c => c.type === ChangeType.DELETE).length, 0
    )

    return {
      unchangedLines,
      changedLines: totalChanges,
      addedLines,
      removedLines,
      structuralChanges: 0,
      contentChanges: totalChanges,
      formattingChanges: 0,
      totalChanges
    }
  }

  private async generateComparisonInsights(version1: WikiVersion, version2: WikiVersion, differences: DetailedDiff[]): Promise<ComparisonInsight[]> {
    const insights: ComparisonInsight[] = []

    if (differences.length > 10) {
      insights.push({
        type: InsightType.CONTENT_QUALITY,
        message: 'Significant content changes detected',
        severity: InsightSeverity.WARNING,
        recommendation: 'Review all changes for accuracy and consistency',
        affectedSections: differences.map(d => d.section)
      })
    }

    const complexityChange = version2.metadata.complexity.overallComplexity - version1.metadata.complexity.overallComplexity
    if (Math.abs(complexityChange) > 0.3) {
      insights.push({
        type: InsightType.COMPLEXITY,
        message: `Complexity ${complexityChange > 0 ? 'increased' : 'decreased'} significantly`,
        severity: complexityChange > 0.5 ? InsightSeverity.ERROR : InsightSeverity.WARNING,
        recommendation: complexityChange > 0 ? 'Consider simplifying the content' : 'Content may be too simplistic',
        affectedSections: ['Overall content']
      })
    }

    return insights
  }

  private calculateSimilarity(content1: string, content2: string): number {
    const words1 = content1.toLowerCase().split(/\s+/)
    const words2 = content2.toLowerCase().split(/\s+/)

    const set1 = new Set(words1)
    const set2 = new Set(words2)
    const intersection = new Set([...set1].filter(word => set2.has(word)))
    const union = new Set([...set1, ...set2])

    return union.size > 0 ? intersection.size / union.size : 0
  }

  private determineComparisonSignificance(similarity: number, totalChanges: number): ComparisonSignificance {
    if (similarity > 0.95) return ComparisonSignificance.IDENTICAL
    if (similarity > 0.8) return ComparisonSignificance.MINOR
    if (similarity > 0.5) return ComparisonSignificance.MODERATE
    if (similarity > 0.2) return ComparisonSignificance.MAJOR
    return ComparisonSignificance.COMPLETELY_DIFFERENT
  }

  private generateComparisonRecommendation(significance: ComparisonSignificance, similarity: number): string {
    switch (significance) {
      case ComparisonSignificance.IDENTICAL:
        return 'No action needed - versions are identical'
      case ComparisonSignificance.MINOR:
        return 'Minor changes - review for accuracy'
      case ComparisonSignificance.MODERATE:
        return 'Moderate changes - thorough review recommended'
      case ComparisonSignificance.MAJOR:
        return 'Major changes - comprehensive review required'
      case ComparisonSignificance.COMPLETELY_DIFFERENT:
        return 'Complete rewrite - extensive review and testing needed'
      default:
        return 'Review changes'
    }
  }

  private determineRiskLevel(significance: ComparisonSignificance, insights: ComparisonInsight[]): RiskLevel {
    const hasCriticalInsights = insights.some(insight => insight.severity === InsightSeverity.CRITICAL)
    const hasErrorInsights = insights.some(insight => insight.severity === InsightSeverity.ERROR)

    if (hasCriticalInsights) return RiskLevel.CRITICAL
    if (hasErrorInsights) return RiskLevel.HIGH
    if (significance === ComparisonSignificance.MAJOR || significance === ComparisonSignificance.COMPLETELY_DIFFERENT) return RiskLevel.MEDIUM
    return RiskLevel.LOW
  }

  private async detectPageConflicts(baseVersion: WikiVersion, incomingVersion: WikiVersion): Promise<Conflict[]> {
    const conflicts: Conflict[] = []

    if (baseVersion.content !== incomingVersion.content) {
      conflicts.push({
        id: this.generateId(),
        type: ConflictType.CONTENT,
        section: 'Content',
        position: 0,
        content: {
          base: baseVersion.content,
          version1: incomingVersion.content,
          version2: incomingVersion.content
        },
        suggestions: [
          {
            type: SuggestionType.MANUAL_REVIEW,
            content: incomingVersion.content,
            confidence: 0.5,
            reasoning: 'Content differs between versions'
          }
        ],
        severity: ConflictSeverity.MEDIUM,
        autoResolvable: false
      })
    }

    return conflicts
  }

  private cleanupOldVersions(pageId: string): void {
    const history = this.getHistory(pageId)
    const cutoffDate = new Date(Date.now() - this.config.retentionPeriod)

    history.versions = history.versions.filter(version =>
      version.timestamp > cutoffDate || version.branch !== 'main'
    )

    this.versions.forEach((version, id) => {
      if (version.pageId === pageId && version.timestamp <= cutoffDate && version.branch === 'main') {
        this.versions.delete(id)
      }
    })
  }

  private extractTitle(content: string): string {
    const titleMatch = content.match(/^#\s+(.+)$/m)
    return titleMatch ? titleMatch[1].trim() : 'Untitled'
  }

  private extractTags(content: string): string[] {
    const tagMatch = content.match(/tags?:\s*(.+)/i)
    if (tagMatch) {
      return tagMatch[1].split(/[,#]/).map(tag => tag.trim()).filter(Boolean)
    }
    return []
  }

  private countWords(text: string): number {
    return text.split(/\s+/).filter(word => word.length > 0).length
  }

  private calculateChecksum(content: string): string {
    return Buffer.from(content).toString('base64').substring(0, 16)
  }

  private detectContentType(content: string): ContentType {
    if (content.includes('```') || content.includes('function') || content.includes('class ')) {
      return ContentType.CODE
    }
    if (content.includes('<') && content.includes('>')) {
      return ContentType.HTML
    }
    if (content.includes('#') || content.includes('*') || content.includes('_')) {
      return ContentType.MARKDOWN
    }
    return ContentType.TEXT
  }

  private detectLanguage(content: string): string {
    if (content.includes('```typescript') || content.includes('.ts')) return 'typescript'
    if (content.includes('```javascript') || content.includes('.js')) return 'javascript'
    if (content.includes('```python') || content.includes('.py')) return 'python'
    if (content.includes('```java')) return 'java'
    if (content.includes('```csharp') || content.includes('.cs')) return 'csharp'
    return 'unknown'
  }

  private determineLinkType(url: string): LinkType {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return LinkType.EXTERNAL
    }
    if (url.startsWith('/')) {
      return LinkType.INTERNAL
    }
    if (url.startsWith('mailto:')) {
      return LinkType.EMAIL
    }
    if (url.startsWith('tel:')) {
      return LinkType.PHONE
    }
    if (url.startsWith('#')) {
      return LinkType.ANCHOR
    }
    return LinkType.INTERNAL
  }

  private isValidUrl(url: string): boolean {
    try {
      new URL(url)
      return true
    } catch {
      return url.startsWith('/') || url.startsWith('#')
    }
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2, 11)
  }
}