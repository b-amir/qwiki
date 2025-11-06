import {
  LoggingService,
  createLogger,
  type Logger,
} from "../../../infrastructure/services/LoggingService";
import type { CodeStructure, FunctionInfo, ClassInfo, InterfaceInfo } from "./shared-types";
import type { CodeRelationship } from "../ContextAnalysisService";
import { RelationshipType } from "../ContextAnalysisService";

export class RelationshipAnalysisService {
  private logger: Logger;

  constructor(private loggingService: LoggingService) {
    this.logger = createLogger("RelationshipAnalysisService");
  }

  analyzeCodeRelationships(
    snippet: string,
    structure: CodeStructure,
    lines?: string[],
  ): CodeRelationship[] {
    const relationships: CodeRelationship[] = [];
    const linesArray = lines || snippet.split("\n");

    const functionMap = new Map<string, FunctionInfo>();
    for (const func of structure.functions) {
      functionMap.set(func.name, func);
    }

    const classMap = new Map<string, ClassInfo>();
    for (const cls of structure.classes) {
      classMap.set(cls.name, cls);
    }

    const interfaceMap = new Map<string, InterfaceInfo>();
    for (const iface of structure.interfaces) {
      interfaceMap.set(iface.name, iface);
    }

    const callGraph = this.buildCallGraph(linesArray, functionMap);

    for (const [caller, callees] of callGraph.entries()) {
      for (const { callee, location } of callees) {
        if (functionMap.has(callee)) {
          relationships.push({
            type: RelationshipType.CALLS,
            source: {
              element: caller,
              type: "function",
              location: { line: 0, column: 0 },
            },
            target: {
              element: callee,
              type: "function",
              location,
            },
            strength: 0.6,
            description: `${caller} calls ${callee}`,
          });
        }
      }
    }

    for (const cls of structure.classes) {
      if (cls.extends) {
        const parentClass = classMap.get(cls.extends);
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
        for (const ifaceName of cls.implements) {
          const interfaceDef = interfaceMap.get(ifaceName);
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

  private buildCallGraph(
    lines: string[],
    functionMap: Map<string, FunctionInfo>,
  ): Map<string, Array<{ callee: string; location: { line: number; column: number } }>> {
    const callGraph = new Map<
      string,
      Array<{ callee: string; location: { line: number; column: number } }>
    >();
    const functionNames = Array.from(functionMap.keys());
    const functionNameRegex = new RegExp(
      `\\b(${functionNames.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\s*\\(`,
      "g",
    );
    const functionDeclarationRegex = new RegExp(
      `\\b(?:function|const|let|var|async)\\s+(${functionNames.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\s*[=(]`,
      "g",
    );

    const functionContextStack: string[] = [];
    let braceDepth = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      for (const char of line) {
        if (char === "{") {
          braceDepth++;
        }
        if (char === "}") {
          braceDepth--;
          if (braceDepth === 0 && functionContextStack.length > 0) {
            functionContextStack.pop();
          }
        }
      }

      functionDeclarationRegex.lastIndex = 0;
      const declMatch = functionDeclarationRegex.exec(line);
      if (declMatch && braceDepth === 0) {
        const funcName = declMatch[1];
        if (functionMap.has(funcName)) {
          functionContextStack.push(funcName);
        }
      }

      functionNameRegex.lastIndex = 0;
      let match;
      while ((match = functionNameRegex.exec(line)) !== null) {
        const calleeName = match[1];
        const callerName =
          functionContextStack.length > 0
            ? functionContextStack[functionContextStack.length - 1]
            : null;

        if (callerName && callerName !== calleeName) {
          if (!callGraph.has(callerName)) {
            callGraph.set(callerName, []);
          }
          callGraph.get(callerName)!.push({
            callee: calleeName,
            location: { line: i, column: match.index },
          });
        }
      }
    }

    return callGraph;
  }
}
