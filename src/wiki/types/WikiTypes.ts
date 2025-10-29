export interface WikiPage {
  id: string
  title: string
  content: string
  metadata: WikiMetadata
  tags: string[]
  relationships: WikiRelationship[]
  languageId?: string
}

export interface WikiMetadata {
  createdAt: Date
  updatedAt: Date
  author: string
  version: number
  status: WikiStatus
  projectId: string
  filePath?: string
  languageId?: string
  providerId?: string
  templateId?: string
}

export interface WikiRelationship {
  targetPageId: string
  type: RelationshipType
  strength: number
  metadata?: Record<string, any>
}

export interface WikiIndex {
  pages: Map<string, IndexEntry>
  categories: Map<string, string[]>
  tags: Map<string, string[]>
  searchIndex: SearchIndex
  metadata: IndexMetadata
}

export interface IndexEntry {
  pageId: string
  title: string
  category: string
  tags: string[]
  keywords: string[]
  excerpt: string
  relevanceScore?: number
}

export interface SearchIndex {
  documents: Map<string, SearchDocument>
  terms: Map<string, string[]>
  metadata: SearchMetadata
}

export interface SearchDocument {
  id: string
  content: string
  title: string
  keywords: string[]
  tokens: string[]
  pageId: string
}

export interface SearchMetadata {
  totalDocuments: number
  totalTerms: number
  lastUpdated: Date
  version: number
}

export interface IndexMetadata {
  projectId: string
  totalPages: number
  totalCategories: number
  totalTags: number
  lastUpdated: Date
  version: number
}

export enum WikiStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  ARCHIVED = 'archived',
  DEPRECATED = 'deprecated'
}

export enum RelationshipType {
  REFERENCES = 'references',
  DEPENDS_ON = 'depends_on',
  SIMILAR_TO = 'similar_to',
  EXTENDS = 'extends',
  IMPLEMENTS = 'implements'
}

export interface WikiStorageConfig {
  storagePath: string
  indexPath: string
  autoSave: boolean
  compressionEnabled: boolean
  encryptionEnabled: boolean
}