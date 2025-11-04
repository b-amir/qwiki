import {
  CustomTextEditorProvider,
  TextDocument,
  WebviewPanel,
  CancellationToken,
  Uri,
  workspace,
  window,
} from "vscode";
import {
  LoggingService,
  createLogger,
  type Logger,
} from "../infrastructure/services/LoggingService";
import type { WikiStorageService } from "../application/services/WikiStorageService";
import { getNonce } from "../utilities/getNonce";
import { getUri } from "../utilities/getUri";

export class WikiCustomEditorProvider implements CustomTextEditorProvider {
  private logger: Logger;

  constructor(
    private wikiStorageService: WikiStorageService,
    private loggingService: LoggingService,
  ) {
    this.logger = createLogger("WikiCustomEditorProvider", loggingService);
  }

  async resolveCustomTextEditor(
    document: TextDocument,
    webviewPanel: WebviewPanel,
    token: CancellationToken,
  ): Promise<void> {
    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [],
    };

    const updateWebview = () => {
      const content = document.getText();
      webviewPanel.webview.html = this.getWebviewContent(content, webviewPanel.webview);
    };

    const changeDocumentSubscription = workspace.onDidChangeTextDocument((e) => {
      if (e.document.uri.toString() === document.uri.toString()) {
        updateWebview();
      }
    });

    webviewPanel.onDidDispose(() => {
      changeDocumentSubscription.dispose();
    });

    webviewPanel.webview.onDidReceiveMessage((message) => {
      switch (message.type) {
        case "save":
          this.saveDocument(document, message.content);
          break;
      }
    });

    updateWebview();
  }

  private getWebviewContent(content: string, webview: any): string {
    const nonce = getNonce();
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; img-src ${webview.cspSource} https:; font-src ${webview.cspSource};">
    <title>Qwiki Editor</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            padding: 20px;
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
        }
        #editor {
            width: 100%;
            min-height: 500px;
            padding: 10px;
            border: 1px solid var(--vscode-input-border);
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            font-family: var(--vscode-editor-font-family);
            font-size: var(--vscode-editor-font-size);
            resize: vertical;
        }
        #preview {
            margin-top: 20px;
            padding: 20px;
            border: 1px solid var(--vscode-panel-border);
            background-color: var(--vscode-editor-background);
            border-radius: 4px;
        }
        button {
            margin-top: 10px;
            padding: 8px 16px;
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            cursor: pointer;
        }
        button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
    </style>
</head>
<body>
    <h2>Qwiki Editor</h2>
    <textarea id="editor">${this.escapeHtml(content)}</textarea>
    <button id="save-button">Save</button>
    <div id="preview"></div>
    <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();
        const editor = document.getElementById('editor');
        const preview = document.getElementById('preview');
        const saveButton = document.getElementById('save-button');
        
        function save() {
            vscode.postMessage({
                type: 'save',
                content: editor.value
            });
        }
        
        saveButton.addEventListener('click', save);
        
        editor.addEventListener('input', () => {
            preview.innerHTML = marked.parse(editor.value);
        });
        
        preview.innerHTML = marked.parse(editor.value);
    </script>
</body>
</html>`;
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  private async saveDocument(document: TextDocument, content: string): Promise<void> {
    try {
      const { WorkspaceEdit, Range } = await import("vscode");
      const edit = new WorkspaceEdit();
      const fullRange = new Range(0, 0, document.lineCount, 0);
      edit.replace(document.uri, fullRange, content);
      await workspace.applyEdit(edit);
      await document.save();
    } catch (error) {
      this.logger.error("Failed to save document", error);
      window.showErrorMessage("Failed to save wiki document");
    }
  }
}
