import {
  CompletionItemProvider,
  CompletionItem,
  TextDocument,
  Position,
  CompletionItemKind,
  MarkdownString,
} from "vscode";
import {
  LoggingService,
  createLogger,
  type Logger,
} from "../infrastructure/services/LoggingService";

const DOCUMENTATION_TEMPLATES = [
  {
    label: "function-doc",
    kind: CompletionItemKind.Snippet,
    detail: "Function documentation template",
    documentation: new MarkdownString("Inserts a JSDoc-style function documentation template"),
    insertText: "/**\n * $1\n * @param {${2:type}} $3 - $4\n * @returns {${5:type}} $6\n */",
  },
  {
    label: "class-doc",
    kind: CompletionItemKind.Snippet,
    detail: "Class documentation template",
    documentation: new MarkdownString("Inserts a JSDoc-style class documentation template"),
    insertText: "/**\n * $1\n * @class ${2:ClassName}\n */",
  },
  {
    label: "interface-doc",
    kind: CompletionItemKind.Snippet,
    detail: "Interface documentation template",
    documentation: new MarkdownString("Inserts a TypeScript interface documentation template"),
    insertText: "/**\n * $1\n * @interface ${2:InterfaceName}\n */",
  },
  {
    label: "method-doc",
    kind: CompletionItemKind.Snippet,
    detail: "Method documentation template",
    documentation: new MarkdownString("Inserts a method documentation template"),
    insertText: "/**\n * $1\n * @param {${2:type}} $3 - $4\n * @returns {${5:type}} $6\n */",
  },
];

export class DocumentationCompletionProvider implements CompletionItemProvider {
  private logger: Logger;

  constructor(private loggingService: LoggingService) {
    this.logger = createLogger("DocumentationCompletionProvider", loggingService);
  }

  async provideCompletionItems(
    document: TextDocument,
    position: Position,
  ): Promise<CompletionItem[]> {
    try {
      const lineText = document.lineAt(position.line).text;
      const beforeCursor = lineText.substring(0, position.character);

      if (beforeCursor.trim() === "/**" || beforeCursor.trim().startsWith("//")) {
        return DOCUMENTATION_TEMPLATES.map((template) => {
          const item = new CompletionItem(template.label, template.kind);
          item.detail = template.detail;
          item.documentation = template.documentation;
          item.insertText = template.insertText;
          return item;
        });
      }

      return [];
    } catch (error) {
      this.logger.error("Failed to provide completion items", error);
      return [];
    }
  }
}
