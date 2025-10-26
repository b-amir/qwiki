import { Disposable, Webview, WebviewView, Uri, window, workspace, ExtensionContext } from "vscode";
import { getUri } from "../utilities/getUri";
import { getNonce } from "../utilities/getNonce";
import { LLMRegistry, type ProviderId } from "../llm";
import { commands } from "vscode";

type SelectionPayload = {
  text: string;
  languageId?: string;
  filePath?: string;
};

/**
 * This class manages the state and behavior of Qwiki webview view.
 *
 * It contains all the data and methods for:
 *
 * - Creating and rendering Qwiki webview view in the sidebar
 * - Setting the HTML (and by proxy CSS/JavaScript) content of the webview view
 * - Setting message listeners so data can be passed between the webview and extension
 */
export class QwikiPanel {
  private readonly _extensionUri: Uri;
  private webview?: Webview;
  private view?: WebviewView;
  private _webviewReady = false;
  private _pendingTab: "wiki" | "settings" | undefined;
  private llms: LLMRegistry;
  private _disposables: Disposable[] = [];
  private _pendingSelection: { payload: SelectionPayload; autoGenerate: boolean } | undefined;
  private _lastSelection: SelectionPayload | undefined;

  /**
   * The QwikiPanel constructor.
   *
   * @param extensionUri The URI of the directory containing the extension
   */
  constructor(
    extensionUri: Uri,
    private ctx: ExtensionContext,
  ) {
    this._extensionUri = extensionUri;
    this.llms = new LLMRegistry(ctx.secrets, {
      zaiBaseUrl: workspace.getConfiguration("qwiki").get<string>("zaiBaseUrl"),
      googleAIEndpoint: workspace.getConfiguration("qwiki").get<string>("googleAIEndpoint"),
    });
  }

  /**
   * Called when the view is first created.
   * This is where we set up the webview content.
   *
   * @param webviewView The webview view to resolve
   */
  public resolveWebviewView(webviewView: WebviewView) {
    // Set options for the webview
    webviewView.webview.options = {
      // Enable JavaScript in the webview
      enableScripts: true,
      // Restrict the webview to only load resources from the `out` and `webview-ui/build` directories
      localResourceRoots: [
        Uri.joinPath(this._extensionUri, "out"),
        Uri.joinPath(this._extensionUri, "webview-ui/build"),
      ],
    };

    this.view = webviewView;
    // Set the HTML content for the webview
    webviewView.webview.html = this._getWebviewContent(webviewView.webview);
    this.webview = webviewView.webview;
    this._webviewReady = false;

    // Set an event listener to listen for messages passed from the webview context
    this._setWebviewMessageListener(webviewView.webview);

    // Clean up when the view is disposed
    webviewView.onDidDispose(() => this.dispose(), null, this._disposables);
  }

  public showTab(tab: "wiki" | "settings") {
    this._queueNavigation(tab);
    commands.executeCommand("workbench.view.extension.qwiki");
    this.view?.show?.(true);
  }

  public createWikiFromEditorSelection() {
    const payload = this._readSelectionFromEditor(false);
    if (!payload) {
      window.showInformationMessage("Open a file to create a Qwiki entry.");
      return;
    }
    if (!payload.text.trim()) {
      window.showInformationMessage(
        "Select some code or add content to the current file to build a wiki.",
      );
      return;
    }
    this._queueSelection(payload, { autoGenerate: true });
    this.showTab("wiki");
    this._flushPendingSelection();
  }

  /**
   * Cleans up and disposes of webview resources when the webview view is closed.
   */
  public dispose() {
    this.webview = undefined;
    this.view = undefined;
    this._webviewReady = false;
    // Dispose of all disposables
    while (this._disposables.length) {
      const disposable = this._disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }

  /**
   * Defines and returns the HTML that should be rendered within the webview view.
   *
   * @remarks This is also the place where references to the Vue webview build files
   * are created and inserted into the webview HTML.
   *
   * @param webview A reference to the extension webview
   * @returns A template string literal containing the HTML that should be
   * rendered within the webview view
   */
  private _getWebviewContent(webview: Webview) {
    // The CSS file from the Vue build output
    const stylesUri = getUri(webview, this._extensionUri, [
      "webview-ui",
      "build",
      "assets",
      "index.css",
    ]);
    // The JS file from the Vue build output
    const scriptUri = getUri(webview, this._extensionUri, [
      "webview-ui",
      "build",
      "assets",
      "index.js",
    ]);

    const nonce = getNonce();

    // Tip: Install the es6-string-html VS Code extension to enable code highlighting below
    return /*html*/ `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
          <link rel="stylesheet" type="text/css" href="${stylesUri}">
          <title>Qwiki</title>
        </head>
        <body>
          <div id="app"></div>
          <script type="module" nonce="${nonce}" src="${scriptUri}"></script>
        </body>
      </html>
    `;
  }

  private _queueNavigation(tab: "wiki" | "settings") {
    this._pendingTab = tab;
    this._flushPendingNavigation();
  }

  private _flushPendingNavigation() {
    if (!this._pendingTab || !this._webviewReady || !this.webview) {
      return;
    }
    this.webview.postMessage({ command: "navigate", payload: { tab: this._pendingTab } });
    this._pendingTab = undefined;
  }

  private _queueSelection(payload: SelectionPayload, options?: { autoGenerate?: boolean }) {
    this._lastSelection = payload;
    this._pendingSelection = { payload, autoGenerate: !!options?.autoGenerate };
    this._flushPendingSelection();
  }

  private _flushPendingSelection() {
    if (!this._pendingSelection || !this._webviewReady || !this.webview) {
      return;
    }
    const { payload, autoGenerate } = this._pendingSelection;
    this.webview.postMessage({ command: "selection", payload });
    if (autoGenerate) {
      this.webview.postMessage({ command: "triggerGenerate" });
    }
    this._pendingSelection = undefined;
  }

  private _readSelectionFromEditor(allowFallback = true): SelectionPayload | undefined {
    const editor = window.activeTextEditor;
    if (!editor) {
      return allowFallback ? this._lastSelection : undefined;
    }
    const { document, selection } = editor;
    const hasSelection = selection && !selection.isEmpty;
    const text = hasSelection ? document.getText(selection) : document.getText();
    return {
      text: text ?? "",
      languageId: document.languageId,
      filePath: document.uri.fsPath,
    };
  }

  /**
   * Sets up an event listener to listen for messages passed from the webview context and
   * executes code based on the message that is received.
   *
   * @param webview A reference to the extension webview
   */
  private _setWebviewMessageListener(webview: Webview) {
    webview.onDidReceiveMessage(
      async (message: any) => {
        try {
          const command = message.command as string;
          switch (command) {
            case "webviewReady": {
              this._webviewReady = true;
              this._flushPendingNavigation();
              this._flushPendingSelection();
              return;
            }
            case "getSelection": {
              const payload = this._readSelectionFromEditor() ??
                this._lastSelection ?? { text: "" };
              this._lastSelection = payload;
              webview.postMessage({ command: "selection", payload });
              return;
            }
            case "getRelated": {
              const payload = this._readSelectionFromEditor() ?? this._lastSelection;
              if (payload) {
                this._lastSelection = payload;
              }
              const text = payload?.text ?? "";
              const languageId = payload?.languageId;
              const filePath = payload?.filePath;
              const project = await this._buildProjectContext(text, filePath, languageId);
              webview.postMessage({ command: "related", payload: project });
              return;
            }
            case "openFile": {
              const { path, line } = message.payload as { path: string; line?: number };
              try {
                const folders = workspace.workspaceFolders;
                let targetUri: Uri | undefined;
                const cleaned = path.replace(/^\.(?:[\\\/]|$)/, "");
                const isAbs = /^\w:\\|^\\\\|^\//.test(path);
                const isAlias = /^@\//.test(cleaned);
                const aliasRemainder = cleaned.replace(/^@\//, "");
                if (isAbs) {
                  targetUri = Uri.file(path);
                } else if (folders && folders.length && !isAlias) {
                  // Try workspace-relative exact path first
                  targetUri = Uri.joinPath(folders[0].uri, cleaned.replace(/^[\\/]+/, ""));
                }
                // If unresolved or alias-like, search workspace with a few strategies
                if (!isAbs && (!targetUri || isAlias) && folders && folders.length) {
                  const globs = new Set<string>();
                  const base = cleaned.replace(/^.*[\\/]/, "");
                  if (isAlias) {
                    globs.add(`**/${aliasRemainder}`);
                    globs.add(`**/src/${aliasRemainder}`);
                  }
                  if (/[\\/]/.test(cleaned)) {
                    globs.add(cleaned);
                    // Try tail segments anywhere
                    globs.add(`**/${cleaned.replace(/^.*?(?=[\\/])/, "")}`);
                  } else {
                    globs.add(`**/${base}`);
                  }
                  let matches: readonly Uri[] = [];
                  for (const g of globs) {
                    matches = await workspace.findFiles(
                      g,
                      "**/{node_modules,dist,out,build,.git,.vscode}/**",
                      5,
                    );
                    if (matches.length) {
                      targetUri = matches[0];
                      break;
                    }
                  }
                }

                if (targetUri) {
                  await commands.executeCommand(
                    "vscode.open",
                    targetUri,
                    line
                      ? {
                          selection: {
                            start: { line: Math.max(0, line - 1), character: 0 },
                            end: { line: Math.max(0, line - 1), character: 0 },
                          },
                        }
                      : undefined,
                  );
                } else {
                  window.showWarningMessage(`Cannot resolve path to open: ${path}`);
                }
              } catch (e: any) {
                window.showErrorMessage(`Failed to open file: ${e?.message || String(e)}`);
              }
              return;
            }
            case "saveApiKey": {
              const { providerId, apiKey } = message.payload as {
                providerId: ProviderId;
                apiKey: string;
              };
              await this.llms.setApiKey(providerId, apiKey);
              webview.postMessage({ command: "apiKeySaved", payload: { providerId } });
              return;
            }
            case "deleteApiKey": {
              const { providerId } = message.payload as { providerId: ProviderId };
              await this.llms.deleteApiKey(providerId);
              webview.postMessage({ command: "apiKeyDeleted", payload: { providerId } });
              return;
            }
            case "getProviders": {
              const list = this.llms.list();
              const statuses = await Promise.all(
                list.map(async (p) => ({
                  id: p.id,
                  name: p.name,
                  models: (p as any).models || [],
                  hasKey: await this.llms.hasApiKey(p.id as ProviderId),
                })),
              );
              webview.postMessage({ command: "providers", payload: statuses });
              return;
            }
            case "getApiKeys": {
              const geminiKey = await this.llms.getApiKey("gemini");
              const zaiKey = await this.llms.getApiKey("zai");
              const openrouterKey = await this.llms.getApiKey("openrouter");
              const googleAIStudioKey = await this.llms.getApiKey("google-ai-studio");
              const cohereKey = await this.llms.getApiKey("cohere");
              const huggingfaceKey = await this.llms.getApiKey("huggingface");
              const googleAIEndpoint =
                workspace.getConfiguration("qwiki").get<string>("googleAIEndpoint") ||
                "openai-compatible";
              webview.postMessage({
                command: "apiKeys",
                payload: {
                  geminiKey,
                  zaiKey,
                  openrouterKey,
                  googleAIStudioKey,
                  cohereKey,
                  huggingfaceKey,
                  googleAIEndpoint,
                },
              });
              return;
            }
            case "generateWiki": {
              const { providerId, model, snippet, languageId, filePath } = message.payload as {
                providerId: ProviderId;
                model?: string;
                snippet: string;
                languageId?: string;
                filePath?: string;
              };

              try {
                // Step 1: Validate selection
                webview.postMessage({ command: "loadingStep", payload: { step: "validating" } });

                if (!snippet?.trim()) {
                  throw new Error(
                    "No code selected. Please select some code to generate documentation.",
                  );
                }

                // Step 2: Analyze code structure and build project context
                webview.postMessage({ command: "loadingStep", payload: { step: "analyzing" } });
                const project = await this._buildProjectContext(
                  snippet,
                  filePath,
                  languageId,
                  webview,
                );

                // Step 3: Find related files (part of context building)
                webview.postMessage({ command: "loadingStep", payload: { step: "finding" } });

                // Step 4: Prepare LLM request
                webview.postMessage({ command: "loadingStep", payload: { step: "preparing" } });

                // Step 5: Generate documentation (this is the main LLM work)
                webview.postMessage({ command: "loadingStep", payload: { step: "generating" } });
                const result = await this.llms.generate(providerId, {
                  model,
                  snippet,
                  languageId,
                  filePath,
                  project,
                });

                // Step 6: Process and format response (minimal processing needed)
                webview.postMessage({ command: "loadingStep", payload: { step: "processing" } });

                // The content is already formatted from the LLM, so we can finalize immediately
                webview.postMessage({ command: "loadingStep", payload: { step: "finalizing" } });

                webview.postMessage({
                  command: "wikiResult",
                  payload: { content: result.content },
                });
              } catch (error: any) {
                webview.postMessage({
                  command: "error",
                  payload: { message: error?.message || "Failed to generate documentation" },
                });
              }
              return;
            }
          }
        } catch (err: any) {
          webview.postMessage({
            command: "error",
            payload: { message: err?.message || String(err) },
          });
        }
      },
      undefined,
      this._disposables,
    );
  }

  private async _buildProjectContext(
    snippet: string,
    filePath?: string,
    languageId?: string,
    webview?: Webview,
  ) {
    const folders = workspace.workspaceFolders;
    const rootName = folders && folders.length ? folders[0].name : undefined;
    // Files sample: gather up to 50 files excluding common build folders
    const files = await workspace.findFiles(
      "**/*",
      "**/{node_modules,dist,out,build,.git,.vscode}/**",
      200,
    );
    const filesSample = files.slice(0, 50).map((u) => this._relative(u));

    // Overview: package.json basic info if present
    let overview = "";
    try {
      const pkgUris = await workspace.findFiles(
        "package.json",
        "**/{node_modules,dist,out,build}/**",
        1,
      );
      if (pkgUris.length) {
        const doc = await workspace.openTextDocument(pkgUris[0]);
        const json = JSON.parse(doc.getText());
        const name = json.name;
        const deps = json.dependencies ? Object.keys(json.dependencies).slice(0, 10) : [];
        const devDeps = json.devDependencies ? Object.keys(json.devDependencies).slice(0, 5) : [];
        overview = [
          name ? `package: ${name}` : undefined,
          deps.length
            ? `deps: ${deps.join(", ")}${json.dependencies && Object.keys(json.dependencies).length > deps.length ? "…" : ""}`
            : undefined,
          devDeps.length
            ? `devDeps: ${devDeps.join(", ")}${json.devDependencies && Object.keys(json.devDependencies).length > devDeps.length ? "…" : ""}`
            : undefined,
        ]
          .filter(Boolean)
          .join("; ");
      }
    } catch {}

    // Related usages via text search on the most likely identifier
    if (webview) {
      webview.postMessage({ command: "loadingStep", payload: { step: "finding" } });
    }
    const token = this._extractIdentifier(snippet) || this._basename(filePath);
    const related = token ? await this._findTextUsages(token) : [];

    return {
      rootName,
      overview,
      filesSample,
      related,
    };
  }

  private _basename(p?: string) {
    if (!p) return undefined;
    const m = /[^\\\/]+$/.exec(p);
    return m ? m[0] : p;
  }

  private _relative(u: Uri) {
    const folders = workspace.workspaceFolders;
    if (!folders || !folders.length) return u.fsPath;
    const root = folders[0].uri.fsPath.replace(/\\+$/, "");
    return u.fsPath.startsWith(root) ? u.fsPath.slice(root.length + 1) : u.fsPath;
  }

  private _extractIdentifier(text: string) {
    // Choose the longest identifier-looking token
    const matches = text.match(/[A-Za-z_][A-Za-z0-9_\-]*/g);
    if (!matches || !matches.length) return undefined;
    // Prefer camelCase/PascalCase or longer tokens
    const scored = matches.map((t) => ({ t, score: (/[A-Z]/.test(t) ? 1 : 0) + t.length / 10 }));
    scored.sort((a, b) => b.score - a.score);
    return scored[0].t;
  }

  private async _findTextUsages(token: string) {
    const related: Array<{ path: string; preview?: string; line?: number; reason?: string }> = [];
    const files = await workspace.findFiles(
      "**/*",
      "**/{node_modules,dist,out,build,.git,.vscode}/**",
      400,
    );
    const re = new RegExp(`\\b${token.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}\\b`);
    for (const uri of files) {
      try {
        const doc = await workspace.openTextDocument(uri);
        const text = doc.getText();
        const m = re.exec(text);
        if (!m) continue;
        const pos = doc.positionAt(m.index);
        const line = pos.line + 1;
        const previewLine = doc.lineAt(pos.line).text.trim();
        related.push({
          path: this._relative(uri),
          line,
          preview: previewLine,
          reason: "text match",
        });
        if (related.length >= 50) break;
      } catch {
        // ignore unreadable files
      }
    }
    return related;
  }
}
