import type { SavedWiki } from "@/application/services/storage/WikiStorageService";
import type { MergeStrategy } from "@/domain/entities/WikiAggregation";

export interface ReadmeUpdateConfig {
  sections: string[];
  preserveCustom: boolean;
  backupOriginal: boolean;
}

export interface ReadmeSection {
  name: string;
  content: string;
  priority: number;
  template?: string;
}

export interface UpdateResult {
  success: boolean;
  changes: string[];
  backupPath?: string;
  conflicts: string[];
  requiresApproval?: boolean;
}

export interface ReadmeAnalysis {
  sections: ReadmeSection[];
  customSections: CustomSection[];
  structure: ReadmeStructure;
  hasExistingContent: boolean;
}

export interface CustomSection {
  name: string;
  content: string;
  startLine: number;
  endLine: number;
}

export interface ReadmeStructure {
  hasTitle: boolean;
  hasDescription: boolean;
  hasInstallation: boolean;
  hasUsage: boolean;
  hasApiDocs: boolean;
  sections: string[];
}

export interface ReadmePreview {
  original: string;
  updated: string;
  changes: SectionChange[];
  warnings: string[];
}

export interface ReadmeStructureValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface SectionChange {
  section: string;
  action: "added" | "updated" | "removed" | "preserved";
  content: string;
}
