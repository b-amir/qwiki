import {
  Disposable,
  Webview,
  WebviewView,
  Uri,
  window,
  workspace,
  ExtensionContext,
  commands,
} from "vscode";
import { LLMRegistry, type ProviderId } from "../llm";
import { getWebviewHtml } from "./webviewContent";
import { buildProjectContext } from "./contextBuilder";
import { tryOpenFile } from "./fileOps";
import { Inbound, Outbound, Page, LoadingStep, Pages } from "./constants";
import { WebviewPaths } from "../constants";
import { Messages } from "./messages";
import {
  VSCodeCommandIds,
  ConfigurationKeys,
  ConfigurationDefaults,
  Extension,
  ProviderIds,
} from "../constants";

type SelectionPayload = {
  text: string;
  languageId?: string;
  filePath?: string;
};

export class QwikiPanel {
  private readonly _extensionUri: Uri;
  private webview?: Webview;
  private view?: WebviewView;
  private _webviewReady = false;
  private _pendingPage: Page | undefined;
  private llms: LLMRegistry;
  private _disposables: Disposable[] = [];
  private _pendingSelection: { payload: SelectionPayload; autoGenerate: boolean } | undefined;
  private _lastSelection: SelectionPayload | undefined;

  constructor(
    extensionUri: Uri,
    private ctx: ExtensionContext,
  ) {
    this._extensionUri = extensionUri;
    this.llms = new LLMRegistry(ctx.secrets, {
      zaiBaseUrl: workspace
        .getConfiguration(Extension.configurationSection)
        .get<string>(ConfigurationKeys.zaiBaseUrl),
      googleAIEndpoint: workspace
        .getConfiguration(Extension.configurationSection)
        .get<string>(ConfigurationKeys.googleAIEndpoint),
    });
  }

  public resolveWebviewView(webviewView: WebviewView) {
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        Uri.joinPath(this._extensionUri, WebviewPaths.out),
        Uri.joinPath(this._extensionUri, WebviewPaths.webviewBuild),
      ],
    };

    this.view = webviewView;
    webviewView.webview.html = getWebviewHtml(webviewView.webview, this._extensionUri);
    this.webview = webviewView.webview;
    this._webviewReady = false;
    this._setWebviewMessageListener(webviewView.webview);
    webviewView.onDidDispose(() => this.dispose(), null, this._disposables);
  }

  public showPage(page: Page) {
    this._queueNavigation(page);
    commands.executeCommand(VSCodeCommandIds.openPanelView);
    this.view?.show?.(true);
  }

  public createWikiFromEditorSelection() {
    const payload = this._readSelectionFromEditor(false);
    if (!payload) {
      window.showInformationMessage(Messages.openFileToCreate);
      return;
    }
    if (!payload.text.trim()) {
      window.showInformationMessage(Messages.selectCodeToBuild);
      return;
    }
    this._queueSelection(payload, { autoGenerate: true });
    this.showPage(Pages.wiki);
    this._flushPendingSelection();
  }

  public dispose() {
    this.webview = undefined;
    this.view = undefined;
    this._webviewReady = false;
    while (this._disposables.length) {
      const disposable = this._disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }

  private _queueNavigation(page: Page) {
    this._pendingPage = page;
    this._flushPendingNavigation();
  }

  private _flushPendingNavigation() {
    if (!this._pendingPage || !this._webviewReady || !this.webview) {
      return;
    }
    this.webview.postMessage({ command: Outbound.navigate, payload: { page: this._pendingPage } });
    this._pendingPage = undefined;
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
    this.webview.postMessage({ command: Outbound.selection, payload });
    if (autoGenerate) {
      this.webview.postMessage({ command: Outbound.triggerGenerate });
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

  private _setWebviewMessageListener(webview: Webview) {
    webview.onDidReceiveMessage(
      async (message: any) => {
        try {
          const command = message.command as string;
          switch (command) {
            case Inbound.webviewReady: {
              this._webviewReady = true;
              this._flushPendingNavigation();
              this._flushPendingSelection();
              return;
            }
            case Inbound.getSelection: {
              const payload = this._readSelectionFromEditor() ??
                this._lastSelection ?? { text: "" };
              this._lastSelection = payload;
              webview.postMessage({ command: Outbound.selection, payload });
              return;
            }
            case Inbound.getRelated: {
              const payload = this._readSelectionFromEditor() ?? this._lastSelection;
              if (payload) {
                this._lastSelection = payload;
              }
              const text = payload?.text ?? "";
              const languageId = payload?.languageId;
              const filePath = payload?.filePath;
              const project = await buildProjectContext(text, filePath, languageId);
              webview.postMessage({ command: Outbound.related, payload: project });
              return;
            }
            case Inbound.openFile: {
              const { path, line } = message.payload as { path: string; line?: number };
              await tryOpenFile(path, line);
              return;
            }
            case Inbound.saveApiKey: {
              const { providerId, apiKey } = message.payload as {
                providerId: ProviderId;
                apiKey: string;
              };
              await this.llms.setApiKey(providerId, apiKey);
              webview.postMessage({ command: Outbound.apiKeySaved, payload: { providerId } });
              return;
            }
            case Inbound.saveSetting: {
              const { setting, value } = message.payload as {
                setting: string;
                value: string;
              };
              const config = workspace.getConfiguration(Extension.configurationSection);
              await config.update(setting, value, true);
              webview.postMessage({ command: Outbound.settingSaved, payload: { setting } });
              return;
            }
            case Inbound.deleteApiKey: {
              const { providerId } = message.payload as { providerId: ProviderId };
              await this.llms.deleteApiKey(providerId);
              webview.postMessage({ command: Outbound.apiKeyDeleted, payload: { providerId } });
              return;
            }
            case Inbound.getProviders: {
              const list = this.llms.list();
              const statuses = await Promise.all(
                list.map(async (p) => {
                  const provider = this.llms.getProvider(p.id as ProviderId);
                  return {
                    id: p.id,
                    name: p.name,
                    models: provider?.listModels?.() || [],
                    hasKey: await this.llms.hasApiKey(p.id as ProviderId),
                  };
                }),
              );
              webview.postMessage({ command: Outbound.providers, payload: statuses });
              return;
            }
            case Inbound.getProviderConfigs: {
              const configs = this.llms.getProviderConfigs();
              webview.postMessage({ command: Outbound.providerConfigs, payload: configs });
              return;
            }
            case Inbound.getApiKeys: {
              const zaiKey = await this.llms.getApiKey(ProviderIds.zai);
              const openrouterKey = await this.llms.getApiKey(ProviderIds.openrouter);
              const googleAIStudioKey = await this.llms.getApiKey(ProviderIds.googleAIStudio);
              const cohereKey = await this.llms.getApiKey(ProviderIds.cohere);
              const huggingfaceKey = await this.llms.getApiKey(ProviderIds.huggingface);
              const zaiBaseUrl =
                workspace
                  .getConfiguration(Extension.configurationSection)
                  .get<string>(ConfigurationKeys.zaiBaseUrl) ||
                ConfigurationDefaults[ConfigurationKeys.zaiBaseUrl];
              const googleAIEndpoint =
                workspace
                  .getConfiguration(Extension.configurationSection)
                  .get<string>(ConfigurationKeys.googleAIEndpoint) ||
                ConfigurationDefaults[ConfigurationKeys.googleAIEndpoint];
              webview.postMessage({
                command: Outbound.apiKeys,
                payload: {
                  zaiKey,
                  openrouterKey,
                  googleAIStudioKey,
                  cohereKey,
                  huggingfaceKey,
                  zaiBaseUrl,
                  googleAIEndpoint,
                },
              });
              return;
            }
            case Inbound.generateWiki: {
              const { providerId, model, snippet, languageId, filePath } = message.payload as {
                providerId: ProviderId;
                model?: string;
                snippet: string;
                languageId?: string;
                filePath?: string;
              };

              try {
                webview.postMessage({
                  command: Outbound.loadingStep,
                  payload: { step: LoadingStep.validating },
                });
                if (!snippet?.trim()) {
                  throw new Error(Messages.noCodeSelected);
                }
                webview.postMessage({
                  command: Outbound.loadingStep,
                  payload: { step: LoadingStep.analyzing },
                });
                const project = await buildProjectContext(snippet, filePath, languageId, webview);
                webview.postMessage({
                  command: Outbound.loadingStep,
                  payload: { step: LoadingStep.finding },
                });
                webview.postMessage({
                  command: Outbound.loadingStep,
                  payload: { step: LoadingStep.preparing },
                });
                webview.postMessage({
                  command: Outbound.loadingStep,
                  payload: { step: LoadingStep.generating },
                });
                const result = await this.llms.generate(providerId, {
                  model,
                  snippet,
                  languageId,
                  filePath,
                  project,
                });
                webview.postMessage({
                  command: Outbound.loadingStep,
                  payload: { step: LoadingStep.processing },
                });
                webview.postMessage({
                  command: Outbound.loadingStep,
                  payload: { step: LoadingStep.finalizing },
                });
                webview.postMessage({
                  command: Outbound.wikiResult,
                  payload: { content: result.content },
                });
              } catch (error: any) {
                webview.postMessage({
                  command: Outbound.error,
                  payload: { message: error?.message || Messages.generateFailedDefault },
                });
              }
              return;
            }
          }
        } catch (err: any) {
          webview.postMessage({
            command: Outbound.error,
            payload: { message: err?.message || String(err) },
          });
        }
      },
      undefined,
      this._disposables,
    );
  }
}
