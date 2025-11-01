import {
  LoggingService,
  createLogger,
  type Logger,
} from "../../../infrastructure/services/LoggingService";
import { PatternExtractionService } from "./PatternExtractionService";
import type {
  CodeStructure,
  FunctionInfo,
  ParameterInfo,
  ClassInfo,
  PropertyInfo,
  MethodInfo,
  ConstructorInfo,
  InterfaceInfo,
  TypeAliasInfo,
  ImportInfo,
  ExportInfo,
} from "./shared-types";

export class StructureAnalysisService {
  private logger: Logger;

  constructor(
    private loggingService: LoggingService,
    private patternExtractionService: PatternExtractionService,
  ) {
    this.logger = createLogger("StructureAnalysisService", loggingService);
  }

  analyzeCodeStructure(snippet: string, language: string, lines?: string[]): CodeStructure {
    const structure: CodeStructure = {
      functions: [],
      classes: [],
      interfaces: [],
      types: [],
      imports: [],
      exports: [],
    };

    const linesArray = lines || snippet.split("\n");

    for (let i = 0; i < linesArray.length; i++) {
      const line = linesArray[i].trim();

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
        continue;
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
        continue;
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
        continue;
      }

      const typeMatch = line.match(this.patternExtractionService.getTypeRegex(language));
      if (typeMatch) {
        structure.types.push({
          name: typeMatch[1] || "unnamed",
          type: this.extractTypeDefinition(line),
          decorators: this.extractDecorators(line),
        });
        continue;
      }

      const importMatch = line.match(this.patternExtractionService.getImportRegex(language));
      if (importMatch) {
        structure.imports.push({
          module: importMatch[2] || importMatch[3] || "unknown",
          elements: this.extractImportElements(importMatch[0]),
          isExternal: importMatch[0].startsWith("from"),
          location: { line: i, column: line.indexOf(importMatch[0]) },
        });
        continue;
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
}
