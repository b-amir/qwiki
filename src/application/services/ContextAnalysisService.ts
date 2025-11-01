import { EventBus } from "../../events/EventBus";
import { LoggingService, createLogger, type Logger } from "../../infrastructure/services/LoggingService";
import { ComplexityCalculationService } from "./context/ComplexityCalculationService";
import { PatternExtractionService } from "./context/PatternExtractionService";
import type {
  CodeContext,
  FunctionInfo,
  ParameterInfo,
  ClassInfo,
  PropertyInfo,
  MethodInfo,
  ConstructorInfo,
  InterfaceInfo,
  TypeAliasInfo,
  CodeStructure,
  ImportInfo,
  ExportInfo,
  ComplexityScore,
} from "./context/shared-types";

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
  ) {
    this.logger = createLogger("ContextAnalysisService", loggingService);
  }

  private logDebug(message: string, data?: unknown): void {
    this.logger.debug(message, data);
  }

  async analyzeDeepContext(
    snippet: string,
    filePath: string,
    projectContext?: any,
  ): Promise<DeepContextAnalysis> {
    this.logDebug("Starting deep context analysis for:", filePath);

    const language = this.detectLanguage(filePath);
    this.logDebug("Detected language:", language);

    const structure = this.analyzeCodeStructure(snippet, language);
    this.logDebug("Analyzed structure:", structure);

    const patterns = this.patternExtractionService.extractCodePatterns(snippet, language);
    this.logDebug("Extracted patterns:", patterns);

    const relationships = this.analyzeCodeRelationships(snippet, structure);
    this.logDebug("Analyzed relationships:", relationships);

    const complexity = this.estimateContextComplexity(snippet, structure);
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

  analyzeCodeStructure(snippet: string, language: string): CodeStructure {
    const structure: CodeStructure = {
      functions: [],
      classes: [],
      interfaces: [],
      types: [],
      imports: [],
      exports: [],
    };

    const lines = snippet.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      const functionMatch = line.match(this.patternExtractionService.getFunctionRegex(language));
      if (functionMatch) {
        structure.functions.push({
          name: functionMatch[1] || "anonymous",
          parameters: this.extractParameters(functionMatch[0]),
          returnType: "any",
          isAsync: line.includes("async"),
          visibility: this.getVisibility(line),
          decorators: this.extractDecorators(line),
        });
      }

      const classMatch = line.match(this.patternExtractionService.getClassRegex(language));
      if (classMatch) {
        structure.classes.push({
          name: classMatch[1] || "anonymous",
          extends: this.extractExtends(line),
          implements: this.extractImplements(line),
          properties: this.extractProperties(line),
          methods: this.extractMethods(line),
          constructors: this.extractConstructors(line),
          decorators: this.extractDecorators(line),
        });
      }

      const interfaceMatch = line.match(this.patternExtractionService.getInterfaceRegex(language));
      if (interfaceMatch) {
        structure.interfaces.push({
          name: interfaceMatch[1] || "unnamed",
          extends: this.extractInterfaceExtends(line),
          properties: this.extractProperties(line),
          methods: this.extractMethods(line),
          decorators: this.extractDecorators(line),
        });
      }

      const typeMatch = line.match(this.patternExtractionService.getTypeRegex(language));
      if (typeMatch) {
        structure.types.push({
          name: typeMatch[1] || "unnamed",
          type: this.extractTypeDefinition(line),
          decorators: this.extractDecorators(line),
        });
      }

      const importMatch = line.match(this.patternExtractionService.getImportRegex(language));
      if (importMatch) {
        structure.imports.push({
          module: importMatch[2] || importMatch[3] || "unknown",
          elements: this.extractImportElements(importMatch[0]),
          isExternal: importMatch[0].startsWith("from"),
          location: { line: i, column: line.indexOf(importMatch[0]) },
        });
      }

      const exportMatch = line.match(this.patternExtractionService.getExportRegex(language));
      if (exportMatch) {
        structure.exports.push({
          element: exportMatch[1] || "default",
          type: this.extractExportType(exportMatch[0]),
          location: { line: i, column: line.indexOf(exportMatch[0]) },
        });
      }
    }

    return structure;
  }

  analyzeCodeRelationships(snippet: string, structure: CodeStructure): CodeRelationship[] {
    const relationships: CodeRelationship[] = [];
    const lines = snippet.split("\n");

    for (const func of structure.functions) {
      for (const otherFunc of structure.functions) {
        if (func.name !== otherFunc.name) {
          const calls = this.findFunctionCalls(func.name, lines);
          for (const call of calls) {
            relationships.push({
              type: RelationshipType.CALLS,
              source: {
                element: func.name,
                type: "function",
                location: { line: 0, column: 0 },
              },
              target: {
                element: otherFunc.name,
                type: "function",
                location: call.location,
              },
              strength: 0.6,
              description: `${func.name} calls ${otherFunc.name}`,
            });
          }
        }
      }
    }

    for (const cls of structure.classes) {
      if (cls.extends) {
        const parentClass = structure.classes.find((c) => c.name === cls.extends);
        if (parentClass) {
          relationships.push({
            type: RelationshipType.INHERITS,
            source: {
              element: parentClass.name,
              type: "class",
              location: { line: 0, column: 0 },
            },
            target: {
              element: cls.name,
              type: "class",
              location: { line: 0, column: 0 },
            },
            strength: 0.9,
            description: `${cls.name} inherits from ${parentClass.name}`,
          });
        }
      }

      if (cls.implements) {
        for (const iface of cls.implements) {
          const interfaceDef = structure.interfaces.find((i) => i.name === iface);
          if (interfaceDef) {
            relationships.push({
              type: RelationshipType.IMPLEMENTS,
              source: {
                element: interfaceDef.name,
                type: "interface",
                location: { line: 0, column: 0 },
              },
              target: {
                element: cls.name,
                type: "class",
                location: { line: 0, column: 0 },
              },
              strength: 0.8,
              description: `${cls.name} implements ${interfaceDef.name}`,
            });
          }
        }
      }
    }

    return relationships;
  }

  estimateContextComplexity(snippet: string, structure: CodeStructure): ComplexityScore {
    return this.complexityCalculationService.estimateContextComplexity(snippet, structure);
  }

  private findFunctionCalls(
    functionName: string,
    lines: string[],
  ): Array<{ name: string; location: { line: number; column: number } }> {
    const calls: Array<{ name: string; location: { line: number; column: number } }> = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const callRegex = new RegExp(`\\b${functionName}\\s*\\(`, "g");
      const match = line.match(callRegex);

      if (match) {
        calls.push({
          name: functionName,
          location: { line: i, column: line.indexOf(match[0]) },
        });
      }
    }

    return calls;
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

  private getVisibility(line: string): "public" | "private" | "protected" {
    if (line.includes("public")) return "public";
    if (line.includes("private")) return "private";
    if (line.includes("protected")) return "protected";
    return "public";
  }

  private extractParameters(functionSignature: string): ParameterInfo[] {
    const paramMatch = functionSignature.match(/\(([^)]*)\)/);
    if (!paramMatch) return [];

    const paramString = paramMatch[1];
    const params = paramString.split(",").map((p) => p.trim());

    return params.map((param) => {
      const [name, type] = param
        .split(":")
        .map((p) => p.trim())
        .reverse();
      const optional = type?.endsWith("?") || false;
      const cleanType = optional ? type.slice(0, -1) : type;

      return {
        name,
        type: cleanType || "any",
        optional,
        description: `${type} ${name}`,
      };
    });
  }

  private extractExtends(line: string): string | undefined {
    const match = line.match(/extends\s+(\w+)/);
    return match ? match[1] : undefined;
  }

  private extractInterfaceExtends(line: string): string[] | undefined {
    const match = line.match(/extends\s+([^\{]+)/);
    if (!match) return undefined;

    const interfaces = match[1].split(",").map((i) => i.trim());
    return interfaces;
  }

  private extractImplements(line: string): string[] | undefined {
    const match = line.match(/implements\s+([^{]*?)\s*\{/);
    if (!match) return undefined;

    const interfaces = match[1].split(",").map((i) => i.trim());
    return interfaces;
  }

  private extractProperties(line: string): PropertyInfo[] {
    const properties: PropertyInfo[] = [];
    const propertyRegex =
      /(?:public\s+|private\s+|protected\s+)?(\w+)\s*:\s*(\w+)(?:\s*=\s*([^;]+))?;/g;
    const matches = Array.from(line.matchAll(propertyRegex) || []);

    for (const match of matches) {
      properties.push({
        name: match[1],
        type: match[2] || "any",
        optional: !match[3],
        visibility: this.getVisibility(line),
      });
    }

    return properties;
  }

  private extractMethods(line: string): MethodInfo[] {
    const methods: MethodInfo[] = [];
    const methodRegex =
      /(?:public\s+|private\s+|protected\s+)?(\w+)\s*\(([^)]*)\)\s*(?:\s*:\s*(\w+))?\s*\{/g;
    const matches = Array.from(line.matchAll(methodRegex) || []);

    for (const match of matches) {
      methods.push({
        name: match[1],
        parameters: this.extractParameters(match[0]),
        returnType: match[3] || "void",
        isAsync: line.includes("async"),
        visibility: this.getVisibility(line),
      });
    }

    return methods;
  }

  private extractConstructors(line: string): ConstructorInfo[] {
    const constructors: ConstructorInfo[] = [];
    const constructorRegex =
      /(?:public\s+|private\s+|protected\s+)?constructor\s*\(([^)]*)\)\s*\{/g;
    const matches = Array.from(line.matchAll(constructorRegex) || []);

    for (const match of matches) {
      constructors.push({
        parameters: this.extractParameters(match[0]),
        visibility: this.getVisibility(line),
      });
    }

    return constructors;
  }

  private extractDecorators(line: string): string[] {
    const decorators: string[] = [];
    const decoratorRegex = /@(\w+)/g;
    const matches = Array.from(line.matchAll(decoratorRegex) || []);

    for (const match of matches) {
      decorators.push(match[1]);
    }

    return decorators;
  }

  private extractExportType(
    exportMatch: string,
  ): "function" | "class" | "interface" | "type" | "const" | "let" | "var" {
    if (exportMatch.includes("class")) return "class";
    if (exportMatch.includes("function")) return "function";
    if (exportMatch.includes("interface")) return "interface";
    if (exportMatch.includes("type")) return "type";
    if (exportMatch.includes("const")) return "const";
    if (exportMatch.includes("let")) return "let";
    if (exportMatch.includes("var")) return "var";
    return "function";
  }

  private extractTypeDefinition(line: string): string {
    const match = line.match(/=\s*(.+?)(?:\s*;|\s*$)/);
    return match ? match[1].trim() || "any" : "any";
  }

  private extractImportElements(importStatement: string): string[] {
    const elements: string[] = [];
    const match = importStatement.match(/\{([^}]+)\}/);

    if (match) {
      const imports = match[1].split(",").map((i) => i.trim());
      elements.push(...imports);
    }

    return elements;
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
