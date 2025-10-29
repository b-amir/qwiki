import { EventBus } from "../../events/EventBus";

export interface CodeContext {
  snippet: string;
  language: string;
  filePath: string;
  projectRoot?: string;
  dependencies?: string[];
  imports?: string[];
  exports?: string[];
  functions?: FunctionInfo[];
  classes?: ClassInfo[];
  interfaces?: InterfaceInfo[];
  types?: TypeAliasInfo[];
}

export interface FunctionInfo {
  name: string;
  parameters: ParameterInfo[];
  returnType: string;
  isAsync: boolean;
  visibility: "public" | "private" | "protected";
  decorators?: string[];
}

export interface ParameterInfo {
  name: string;
  type: string;
  optional: boolean;
  defaultValue?: any;
  description?: string;
}

export interface ClassInfo {
  name: string;
  extends?: string;
  implements?: string[];
  properties: PropertyInfo[];
  methods: MethodInfo[];
  constructors?: ConstructorInfo[];
  decorators?: string[];
}

export interface PropertyInfo {
  name: string;
  type: string;
  optional: boolean;
  visibility: "public" | "private" | "protected";
  decorators?: string[];
}

export interface MethodInfo {
  name: string;
  parameters: ParameterInfo[];
  returnType: string;
  isAsync: boolean;
  visibility: "public" | "private" | "protected";
  decorators?: string[];
}

export interface ConstructorInfo {
  parameters: ParameterInfo[];
  visibility: "public" | "private" | "protected";
}

export interface InterfaceInfo {
  name: string;
  extends?: string[];
  properties: PropertyInfo[];
  methods: MethodInfo[];
  decorators?: string[];
}

export interface TypeAliasInfo {
  name: string;
  type: string;
  decorators?: string[];
}

export interface DeepContextAnalysis {
  structure: CodeStructure;
  patterns: CodePattern[];
  relationships: CodeRelationship[];
  complexity: ComplexityScore;
  language: string;
  framework?: string;
}

export interface CodeStructure {
  functions: FunctionInfo[];
  classes: ClassInfo[];
  interfaces: InterfaceInfo[];
  types: TypeAliasInfo[];
  imports: ImportInfo[];
  exports: ExportInfo[];
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

export interface ComplexityScore {
  overall: number;
  cyclomatic: number;
  cognitive: number;
  halstead: {
    volume: number;
    difficulty: number;
    effort: number;
  };
  lines: number;
  functions: number;
  classes: number;
  interfaces: number;
}

export interface ImportInfo {
  module: string;
  elements: string[];
  isExternal: boolean;
  location: {
    line: number;
    column: number;
  };
}

export interface ExportInfo {
  element: string;
  type: "function" | "class" | "interface" | "type" | "const" | "let" | "var";
  location: {
    line: number;
    column: number;
  };
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
  constructor(private eventBus: EventBus) {}

  async analyzeDeepContext(
    snippet: string,
    filePath: string,
    projectContext?: any,
  ): Promise<DeepContextAnalysis> {
    console.log("[ContextAnalysisService] Starting deep context analysis for:", filePath);
    
    const language = this.detectLanguage(filePath);
    console.log("[ContextAnalysisService] Detected language:", language);
    
    const structure = this.analyzeCodeStructure(snippet, language);
    console.log("[ContextAnalysisService] Analyzed structure:", structure);
    
    const patterns = this.extractCodePatterns(snippet, language);
    console.log("[ContextAnalysisService] Extracted patterns:", patterns);
    
    const relationships = this.analyzeCodeRelationships(snippet, structure);
    console.log("[ContextAnalysisService] Analyzed relationships:", relationships);
    
    const complexity = this.estimateContextComplexity(snippet, structure);
    console.log("[ContextAnalysisService] Estimated complexity:", complexity);

    const framework = this.detectFramework(snippet, language);
    console.log("[ContextAnalysisService] Detected framework:", framework);

    const analysis: DeepContextAnalysis = {
      structure,
      patterns,
      relationships,
      complexity,
      language,
      framework,
    };

    console.log("[ContextAnalysisService] Publishing context-analyzed event");
    this.eventBus.publish("context-analyzed", { snippet, filePath, analysis });
    return analysis;
  }

  extractCodePatterns(snippet: string, language: string): CodePattern[] {
    const patterns: CodePattern[] = [];

    patterns.push(...this.extractFunctionPatterns(snippet, language));
    patterns.push(...this.extractClassPatterns(snippet, language));
    patterns.push(...this.extractInterfacePatterns(snippet, language));
    patterns.push(...this.extractImportPatterns(snippet, language));
    patterns.push(...this.extractVariablePatterns(snippet, language));
    patterns.push(...this.extractControlFlowPatterns(snippet, language));

    return patterns;
  }

  private extractFunctionPatterns(snippet: string, language: string): CodePattern[] {
    const patterns: CodePattern[] = [];
    const lines = snippet.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      const functionRegex = this.getFunctionRegex(language);
      const matches = Array.from(line.matchAll(functionRegex) || []);

      for (const match of matches) {
        patterns.push({
          type: PatternType.FUNCTION_DECLARATION,
          name: match[1] || "anonymous",
          description: `Function declaration: ${match[0]}`,
          confidence: 0.9,
          location: { line: i, column: line.indexOf(match[0]) },
        });
      }
    }

    return patterns;
  }

  private extractClassPatterns(snippet: string, language: string): CodePattern[] {
    const patterns: CodePattern[] = [];
    const lines = snippet.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      const classRegex = this.getClassRegex(language);
      const matches = Array.from(line.matchAll(classRegex) || []);

      for (const match of matches) {
        patterns.push({
          type: PatternType.CLASS_DECLARATION,
          name: match[1] || "anonymous",
          description: `Class declaration: ${match[0]}`,
          confidence: 0.9,
          location: { line: i, column: line.indexOf(match[0]) },
        });
      }
    }

    return patterns;
  }

  private extractInterfacePatterns(snippet: string, language: string): CodePattern[] {
    const patterns: CodePattern[] = [];
    const lines = snippet.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      const interfaceRegex = this.getInterfaceRegex(language);
      const matches = Array.from(line.matchAll(interfaceRegex) || []);

      for (const match of matches) {
        patterns.push({
          type: PatternType.INTERFACE_DECLARATION,
          name: match[1] || "unnamed",
          description: `Interface declaration: ${match[0]}`,
          confidence: 0.9,
          location: { line: i, column: line.indexOf(match[0]) },
        });
      }
    }

    return patterns;
  }

  private extractImportPatterns(snippet: string, language: string): CodePattern[] {
    const patterns: CodePattern[] = [];
    const lines = snippet.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      const importRegex = this.getImportRegex(language);
      const matches = Array.from(line.matchAll(importRegex) || []);

      for (const match of matches) {
        patterns.push({
          type: PatternType.IMPORT_STATEMENT,
          name: match[2] || match[3] || "unknown",
          description: `Import statement: ${match[0]}`,
          confidence: 0.8,
          location: { line: i, column: line.indexOf(match[0]) },
        });
      }
    }

    return patterns;
  }

  private extractVariablePatterns(snippet: string, language: string): CodePattern[] {
    const patterns: CodePattern[] = [];
    const lines = snippet.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      const variableRegex = this.getVariableRegex(language);
      const matches = Array.from(line.matchAll(variableRegex) || []);

      for (const match of matches) {
        patterns.push({
          type: PatternType.VARIABLE_DECLARATION,
          name: match[1] || "unnamed",
          description: `Variable declaration: ${match[0]}`,
          confidence: 0.7,
          location: { line: i, column: line.indexOf(match[0]) },
        });
      }
    }

    return patterns;
  }

  private extractControlFlowPatterns(snippet: string, language: string): CodePattern[] {
    const patterns: CodePattern[] = [];
    const lines = snippet.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      if (
        line.includes("if") ||
        line.includes("switch") ||
        line.includes("for") ||
        line.includes("while")
      ) {
        patterns.push({
          type: PatternType.CONDITIONAL,
          name: "control-flow",
          description: `Control flow statement: ${line.substring(0, 50)}`,
          confidence: 0.8,
          location: { line: i, column: 0 },
        });
      }

      if (line.includes("try") || line.includes("catch")) {
        patterns.push({
          type: PatternType.ERROR_HANDLING,
          name: "error-handling",
          description: `Error handling: ${line.substring(0, 50)}`,
          confidence: 0.8,
          location: { line: i, column: 0 },
        });
      }

      if (line.includes("await")) {
        patterns.push({
          type: PatternType.ASYNC_AWAIT,
          name: "async-await",
          description: `Async operation: ${line.substring(0, 50)}`,
          confidence: 0.8,
          location: { line: i, column: 0 },
        });
      }
    }

    return patterns;
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

      const functionMatch = line.match(this.getFunctionRegex(language));
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

      const classMatch = line.match(this.getClassRegex(language));
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

      const interfaceMatch = line.match(this.getInterfaceRegex(language));
      if (interfaceMatch) {
        structure.interfaces.push({
          name: interfaceMatch[1] || "unnamed",
          extends: this.extractInterfaceExtends(line),
          properties: this.extractProperties(line),
          methods: this.extractMethods(line),
          decorators: this.extractDecorators(line),
        });
      }

      const typeMatch = line.match(this.getTypeRegex(language));
      if (typeMatch) {
        structure.types.push({
          name: typeMatch[1] || "unnamed",
          type: this.extractTypeDefinition(line),
          decorators: this.extractDecorators(line),
        });
      }

      const importMatch = line.match(this.getImportRegex(language));
      if (importMatch) {
        structure.imports.push({
          module: importMatch[2] || importMatch[3] || "unknown",
          elements: this.extractImportElements(importMatch[0]),
          isExternal: importMatch[0].startsWith("from"),
          location: { line: i, column: line.indexOf(importMatch[0]) },
        });
      }

      const exportMatch = line.match(this.getExportRegex(language));
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
    const lines = snippet.split("\n");
    const functionCount = structure.functions.length;
    const classCount = structure.classes.length;
    const interfaceCount = structure.interfaces.length;
    const maxNestingDepth = this.calculateMaxNestingDepth(snippet);

    const cyclomatic = this.calculateCyclomaticComplexity(structure);
    const cognitive = this.calculateCognitiveComplexity(snippet, structure);
    const halstead = this.calculateHalsteadComplexity(snippet, structure);

    return {
      overall: cyclomatic * 0.3 + cognitive * 0.4 + halstead.volume * 0.2 + maxNestingDepth * 0.1,
      cyclomatic,
      cognitive,
      halstead: {
        volume: halstead.volume,
        difficulty: halstead.difficulty,
        effort: halstead.effort,
      },
      lines: lines.length,
      functions: functionCount,
      classes: classCount,
      interfaces: interfaceCount,
    };
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

  private calculateMaxNestingDepth(snippet: string): number {
    let maxDepth = 0;
    let currentDepth = 0;

    for (const char of snippet) {
      if (char === "{") currentDepth++;
      if (char === "}") currentDepth--;
      maxDepth = Math.max(maxDepth, currentDepth);
    }

    return maxDepth;
  }

  private calculateCyclomaticComplexity(structure: CodeStructure): number {
    let complexity = 1;

    for (const func of structure.functions) {
      complexity += func.parameters.length + 1;
    }

    for (const cls of structure.classes) {
      complexity += cls.methods.length + cls.properties.length + 1;
    }

    return complexity;
  }

  private calculateCognitiveComplexity(snippet: string, structure: CodeStructure): number {
    const lines = snippet.split("\n");
    let complexity = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (
        line.includes("if") ||
        line.includes("switch") ||
        line.includes("for") ||
        line.includes("while")
      ) {
        complexity += 1;
      }

      if (line.includes("try") || line.includes("catch")) {
        complexity += 1;
      }

      if (line.includes("&&") || line.includes("||")) {
        complexity += 1;
      }
    }

    return complexity;
  }

  private calculateHalsteadComplexity(
    snippet: string,
    structure: CodeStructure,
  ): { volume: number; difficulty: number; effort: number } {
    const operators = new Set<string>();
    const operands = new Set<string>();

    const lines = snippet.split("\n");
    for (const line of lines) {
      const lineOperators = this.extractHalsteadOperators(line);
      const lineOperands = this.extractHalsteadOperands(line);

      lineOperators.forEach((op) => operators.add(op));
      lineOperands.forEach((op) => operands.add(op));
    }

    const n1 = operators.size;
    const n2 = operands.size;
    const volume = n1 * Math.log2(n2);
    const difficulty = (n1 / 2) * n2;
    const effort = difficulty * n2;

    return { volume, difficulty, effort };
  }

  private extractHalsteadOperators(line: string): string[] {
    const operators: string[] = [];
    const operatorRegex = /[+\-*/%=<>!&|^]{1,2}/g;

    let match;
    while ((match = operatorRegex.exec(line)) !== null) {
      operators.push(match[0]);
    }

    return operators;
  }

  private extractHalsteadOperands(line: string): string[] {
    const operands: string[] = [];
    const words = line.split(/\s+/).filter((word) => word.length > 2);

    for (const word of words) {
      if (!/[+\-*/%=<>!&|^]/.test(word)) {
        operands.push(word);
      }
    }

    return operands;
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

  private getFunctionRegex(language: string): RegExp {
    console.log("[ContextAnalysisService] Getting function regex for language:", language);
    switch (language) {
      case "typescript":
      case "javascript":
        const tsJsRegex = /(?:function\s+(\w+)\s*\([^)]*\)\s*(?::\s*\w+)?\s*(?:=>|\{))|(?:const\s+(\w+)\s*=\s*(?:\([^)]*\))\s*(?::\s*\w+)?\s*(?:=>|\{))|(?:let\s+(\w+)\s*=\s*(?:\([^)]*\))\s*(?::\s*\w+)?\s*(?:=>|\{))|(?:var\s+(\w+)\s*=\s*(?:\([^)]*\))\s*(?::\s*\w+)?\s*(?:=>|\{))/g;
        console.log("[ContextAnalysisService] TypeScript/JavaScript function regex:", tsJsRegex);
        return tsJsRegex;
      case "python":
        const pythonRegex = /(?:def\s+(\w+)\s*\([^)]*\)\s*:)|(?:class\s+(\w+)\s*\([^)]*\)\s*:)|(?:async\s+def\s+(\w+)\s*\([^)]*\)\s*:)/g;
        console.log("[ContextAnalysisService] Python function regex:", pythonRegex);
        return pythonRegex;
      case "java":
      case "csharp":
        const classPattern = /(?:public\s+|private\s+|protected\s+|static\s+)*(?:final\s+)?class\s+(\w+)\s*(?:\([^)]*\))?\s*\{/g;
        const interfacePattern = /(?:public\s+|private\s+|protected\s+|static\s+)*(?:final\s+)?interface\s+(\w+)\s*(?:\([^)]*\))?\s*\{/g;
        const enumPattern = /(?:public\s+|private\s+|protected\s+|static\s+)*(?:final\s+)?enum\s+(\w+)\s*\{/g;
        const methodPattern = /(?:public\s+|private\s+|protected\s+|static\s+)*(?:final\s+)?(\w+)\s+(\w+)\s*(?:\([^)]*\))\s*[;{]/g;
        
        const javaCSharpRegex = new RegExp([
          classPattern.source,
          interfacePattern.source,
          enumPattern.source,
          methodPattern.source
        ].join('|'), 'g');
        
        console.log("[ContextAnalysisService] Java/C# function regex:", javaCSharpRegex);
        return javaCSharpRegex;
      default:
        const defaultRegex = /function\s+(\w+)\s*\([^)]*\)/g;
        console.log("[ContextAnalysisService] Default function regex:", defaultRegex);
        return defaultRegex;
    }
  }

  private getClassRegex(language: string): RegExp {
    console.log("[ContextAnalysisService] Getting class regex for language:", language);
    switch (language) {
      case "typescript":
      case "javascript":
        const tsClassRegex = /(?:class\s+(\w+)\s*(?:extends\s+(\w+))?\s*(?:implements\s+([^\{]+))?\s*\{)/g;
        console.log("[ContextAnalysisService] TypeScript class regex:", tsClassRegex);
        return tsClassRegex;
      case "python":
        const pyClassRegex = /class\s+(\w+)\s*(?:\([^)]*\))?\s*(?::\s*([^\n]+))?/g;
        console.log("[ContextAnalysisService] Python class regex:", pyClassRegex);
        return pyClassRegex;
      case "java":
      case "csharp":
        const javaClassRegex = /(?:public\s+|private\s+|protected\s+|static\s+)*(?:final\s+)?(?:class\s+(\w+)\s*(?:extends\s+(\w+))?\s*(?:implements\s+([^\{]+))?\s*\{)/g;
        console.log("[ContextAnalysisService] Java/C# class regex:", javaClassRegex);
        return javaClassRegex;
      default:
        const defaultClassRegex = /class\s+(\w+)\s*(?:extends\s+(\w+))?\s*(?:implements\s+([^\{]+))?\s*\{/g;
        console.log("[ContextAnalysisService] Default class regex:", defaultClassRegex);
        return defaultClassRegex;
    }
  }

  private getInterfaceRegex(language: string): RegExp {
    console.log("[ContextAnalysisService] Getting interface regex for language:", language);
    switch (language) {
      case "typescript":
      case "javascript":
        const tsInterfaceRegex = /interface\s+(\w+)\s*(?:extends\s+([^\{]+))?\s*\{/g;
        console.log("[ContextAnalysisService] TypeScript interface regex:", tsInterfaceRegex);
        return tsInterfaceRegex;
      case "python":
        const pyInterfaceRegex = /(?:class\s+(\w+)\s*(?:\([^)]*\))?\s*:)?\s*interface\s+(\w+)\s*(?:\([^)]*\))?\s*\{/g;
        console.log("[ContextAnalysisService] Python interface regex:", pyInterfaceRegex);
        return pyInterfaceRegex;
      default:
        const defaultInterfaceRegex = /interface\s+(\w+)\s*(?:extends\s+([^\{]+))?\s*\{/g;
        console.log("[ContextAnalysisService] Default interface regex:", defaultInterfaceRegex);
        return defaultInterfaceRegex;
    }
  }

  private getImportRegex(language: string): RegExp {
    console.log("[ContextAnalysisService] Getting import regex for language:", language);
    switch (language) {
      case "typescript":
      case "javascript":
        const tsImportRegex = /(?:import\s+(?:\*\s+as\s+)?([^\s]+)\s+from\s+['"]([^'"]+)['"]|import\s+(?:\*\s+as\s+)?([^\s]+)\s*from\s+([^\s]+)\s*;|import\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"])/g;
        console.log("[ContextAnalysisService] TypeScript import regex:", tsImportRegex);
        return tsImportRegex;
      case "python":
        const pyImportRegex = /(?:from\s+([^\s]+)\s+import\s+(.+)|import\s+([^\s]+))/g;
        console.log("[ContextAnalysisService] Python import regex:", pyImportRegex);
        return pyImportRegex;
      default:
        const defaultImportRegex = /import\s+([^\s]+)/g;
        console.log("[ContextAnalysisService] Default import regex:", defaultImportRegex);
        return defaultImportRegex;
    }
  }

  private getExportRegex(language: string): RegExp {
    switch (language) {
      case "typescript":
      case "javascript":
        return /export\s+(?:default\s+)?(?:class\s+(\w+)|function\s+(\w+)|interface\s+(\w+)|type\s+(\w+)|const\s+(\w+)|let\s+(\w+)|var\s+(\w+))/g;
      default:
        return /export\s+(?:default\s+)?(\w+)/g;
    }
  }

  private getTypeRegex(language: string): RegExp {
    switch (language) {
      case "typescript":
        return /type\s+(\w+)\s*=\s*(?:\([^)]*\))?\s*[:=>]/g;
      default:
        return /type\s+(\w+)\s*=\s*([^;]+)/g;
    }
  }

  private getVariableRegex(language: string): RegExp {
    switch (language) {
      case "typescript":
      case "javascript":
        return /(?:const|let|var)\s+(\w+)\s*(?::\s*\w+)?\s*=\s*[^;]+/g;
      case "python":
        return /(\w+)\s*=\s*[^=]+/g;
      case "java":
      case "csharp":
        return /(?:public\s+|private\s+|protected\s+|static\s+)*(?:final\s+)?(?:\w+\s+)+(\w+)\s*(?:=\s*[^;]+)?;/g;
      default:
        return /(?:const|let|var)\s+(\w+)\s*=\s*[^;]+/g;
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
    console.log("[ContextAnalysisService] Detecting framework for language:", language);
    
    if (language === "typescript" || language === "javascript") {
      if (snippet.includes("import React") || snippet.includes("from 'react'") || snippet.includes("from \"react\"")) {
        console.log("[ContextAnalysisService] Detected React framework");
        return "react";
      }
      
      if (snippet.includes("import { createApp }") || snippet.includes("from 'vue'") || snippet.includes("from \"vue\"")) {
        console.log("[ContextAnalysisService] Detected Vue framework");
        return "vue";
      }
      
      if (snippet.includes("@Component") || snippet.includes("@NgModule") || snippet.includes("from '@angular/core'")) {
        console.log("[ContextAnalysisService] Detected Angular framework");
        return "angular";
      }
      
      if (snippet.includes("require('express')") || snippet.includes("from 'express'") || snippet.includes("from \"express\"")) {
        console.log("[ContextAnalysisService] Detected Express framework");
        return "express";
      }
      
      if (snippet.includes("from 'next'") || snippet.includes("from \"next\"") || snippet.includes("import { NextApiRequest")) {
        console.log("[ContextAnalysisService] Detected Next.js framework");
        return "nextjs";
      }
    }
    
    if (language === "python") {
      if (snippet.includes("from django") || snippet.includes("import django")) {
        console.log("[ContextAnalysisService] Detected Django framework");
        return "django";
      }
      
      if (snippet.includes("from flask") || snippet.includes("import flask")) {
        console.log("[ContextAnalysisService] Detected Flask framework");
        return "flask";
      }
      
      if (snippet.includes("from fastapi") || snippet.includes("import fastapi")) {
        console.log("[ContextAnalysisService] Detected FastAPI framework");
        return "fastapi";
      }
    }
    
    console.log("[ContextAnalysisService] No specific framework detected");
    return undefined;
  }
}
