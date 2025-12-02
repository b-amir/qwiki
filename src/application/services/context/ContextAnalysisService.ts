import { EventBus } from "@/events/EventBus";
import { LoggingService, createLogger, type Logger } from "@/infrastructure/services";
import { ComplexityCalculationService } from "@/application/services/context/analysis/ComplexityCalculationService";
import { PatternExtractionService } from "@/application/services/context/analysis/PatternExtractionService";
import { StructureAnalysisService } from "@/application/services/context/analysis/StructureAnalysisService";
import { RelationshipAnalysisService } from "@/application/services/context/analysis/RelationshipAnalysisService";
import type {
  CodeContext,
  CodeStructure,
  ComplexityScore,
} from "@/application/services/context/analysis/shared-types";
import type { ProjectContext } from "@/domain/entities/Selection";

export interface DeepContextAnalysis {
  structure: CodeStructure;
  patterns: CodePattern[];
  relationships: CodeRelationship[];
  complexity: ComplexityScore;
  language: string;
  framework?: string;
}

export interface CodePattern {
  type: PatternType;
  name: string;
  description: string;
  confidence: number;
  location: {
    line: number;
    column: number;
  };
}

export interface CodeRelationship {
  type: RelationshipType;
  source: {
    element: string;
    type: "function" | "class" | "interface" | "type";
    location: {
      line: number;
      column: number;
    };
  };
  target: {
    element: string;
    type: "function" | "class" | "interface" | "type";
    location: {
      line: number;
      column: number;
    };
  };
  strength: number;
  description: string;
}

export enum PatternType {
  FUNCTION_DECLARATION = "function-declaration",
  CLASS_DECLARATION = "class-declaration",
  INTERFACE_DECLARATION = "interface-declaration",
  TYPE_ALIAS = "type-alias",
  IMPORT_STATEMENT = "import-statement",
  EXPORT_STATEMENT = "export-statement",
  VARIABLE_DECLARATION = "variable-declaration",
  METHOD_CALL = "method-call",
  PROPERTY_ACCESS = "property-access",
  CONDITIONAL = "conditional",
  LOOP = "loop",
  ERROR_HANDLING = "error-handling",
  ASYNC_AWAIT = "async-await",
  PROMISE_CHAIN = "promise-chain",
  DESTRUCTURING = "destructuring",
  SPREAD_OPERATOR = "spread-operator",
  TEMPLATE_LITERAL = "template-literal",
  ARROW_FUNCTION = "arrow-function",
  GENERATOR_FUNCTION = "generator-function",
  DECORATOR = "decorator",
}

export enum RelationshipType {
  INHERITS = "inherits",
  IMPLEMENTS = "implements",
  USES = "uses",
  CALLS = "calls",
  IMPORTS = "imports",
  EXTENDS = "extends",
  REFERENCES = "references",
  DECORATES = "decorates",
  DEPENDS_ON = "depends-on",
}

export class ContextAnalysisService {
  private logger: Logger;

  constructor(
    private eventBus: EventBus,
    private loggingService: LoggingService,
    private complexityCalculationService: ComplexityCalculationService,
    private patternExtractionService: PatternExtractionService,
    private structureAnalysisService: StructureAnalysisService,
    private relationshipAnalysisService: RelationshipAnalysisService,
  ) {
    this.logger = createLogger("ContextAnalysisService");
  }

  private logDebug(message: string, data?: unknown): void {
    this.logger.debug(message, data);
  }

  async analyzeDeepContext(
    snippet: string,
    filePath: string,
    projectContext?: ProjectContext,
  ): Promise<DeepContextAnalysis> {
    this.logDebug("Starting deep context analysis for:", filePath);

    const language = this.detectLanguage(filePath);
    this.logDebug("Detected language:", language);

    const lines = snippet.split("\n");
    const structure = this.structureAnalysisService.analyzeCodeStructure(snippet, language, lines);
    this.logDebug("Analyzed structure:", structure);

    const patterns = this.patternExtractionService.extractCodePatterns(snippet, language);
    this.logDebug("Extracted patterns:", patterns);

    const relationships = this.relationshipAnalysisService.analyzeCodeRelationships(
      snippet,
      structure,
      lines,
    );
    this.logDebug("Analyzed relationships:", relationships);

    const complexity = this.estimateContextComplexity(snippet, structure, lines);
    this.logDebug("Estimated complexity:", complexity);

    const framework = this.detectFramework(snippet, language);
    this.logDebug("Detected framework:", framework);

    const analysis: DeepContextAnalysis = {
      structure,
      patterns,
      relationships,
      complexity,
      language,
      framework,
    };

    this.logDebug("Publishing context-analyzed event");
    this.eventBus.publish("context-analyzed", { snippet, filePath, analysis });
    return analysis;
  }

  estimateContextComplexity(
    snippet: string,
    structure: CodeStructure,
    lines?: string[],
  ): ComplexityScore {
    return this.complexityCalculationService.estimateContextComplexity(snippet, structure, lines);
  }

  private detectLanguage(filePath: string): string {
    const ext = filePath.split(".").pop()?.toLowerCase();

    switch (ext) {
      case "ts":
      case "tsx":
        return "typescript";
      case "js":
      case "jsx":
        return "javascript";
      case "py":
        return "python";
      case "java":
        return "java";
      case "cpp":
      case "cxx":
        return "cpp";
      case "c":
        return "c";
      case "cs":
        return "csharp";
      case "go":
        return "go";
      case "rs":
        return "rust";
      case "php":
        return "php";
      case "rb":
        return "ruby";
      default:
        return "unknown";
    }
  }

  private detectFramework(snippet: string, language: string): string | undefined {
    this.logDebug("Detecting framework for language:", language);

    if (language === "typescript" || language === "javascript") {
      if (
        snippet.includes("import React") ||
        snippet.includes("from 'react'") ||
        snippet.includes('from "react"')
      ) {
        this.logDebug("Detected React framework");
        return "react";
      }

      if (
        snippet.includes("import { createApp }") ||
        snippet.includes("from 'vue'") ||
        snippet.includes('from "vue"')
      ) {
        this.logDebug("Detected Vue framework");
        return "vue";
      }

      if (
        snippet.includes("@Component") ||
        snippet.includes("@NgModule") ||
        snippet.includes("from '@angular/core'")
      ) {
        this.logDebug("Detected Angular framework");
        return "angular";
      }

      if (
        snippet.includes("require('express')") ||
        snippet.includes("from 'express'") ||
        snippet.includes('from "express"')
      ) {
        this.logDebug("Detected Express framework");
        return "express";
      }

      if (
        snippet.includes("from 'next'") ||
        snippet.includes('from "next"') ||
        snippet.includes("import { NextApiRequest")
      ) {
        this.logDebug("Detected Next.js framework");
        return "nextjs";
      }
    }

    if (language === "python") {
      if (snippet.includes("from django") || snippet.includes("import django")) {
        this.logDebug("Detected Django framework");
        return "django";
      }

      if (snippet.includes("from flask") || snippet.includes("import flask")) {
        this.logDebug("Detected Flask framework");
        return "flask";
      }

      if (snippet.includes("from fastapi") || snippet.includes("import fastapi")) {
        this.logDebug("Detected FastAPI framework");
        return "fastapi";
      }
    }

    this.logDebug("No specific framework detected");
    return undefined;
  }
}
