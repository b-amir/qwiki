import { Disposable, Webview, WebviewView, Uri, window } from "vscode";
import { getUri } from "../utilities/getUri";
import { getNonce } from "../utilities/getNonce";

/**
 * This class manages the state and behavior of HelloWorld webview view.
 *
 * It contains all the data and methods for:
 *
 * - Creating and rendering HelloWorld webview view in the sidebar
 * - Setting the HTML (and by proxy CSS/JavaScript) content of the webview view
 * - Setting message listeners so data can be passed between the webview and extension
 */
export class HelloWorldPanel {
  private readonly _extensionUri: Uri;
  private _disposables: Disposable[] = [];

  /**
   * The HelloWorldPanel constructor.
   *
   * @param extensionUri The URI of the directory containing the extension
   */
  constructor(extensionUri: Uri) {
    this._extensionUri = extensionUri;
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

    // Set the HTML content for the webview
    webviewView.webview.html = this._getWebviewContent(webviewView.webview);

    // Set an event listener to listen for messages passed from the webview context
    this._setWebviewMessageListener(webviewView.webview);

    // Clean up when the view is disposed
    webviewView.onDidDispose(() => this.dispose(), null, this._disposables);
  }

  /**
   * Cleans up and disposes of webview resources when the webview view is closed.
   */
  public dispose() {
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
    const stylesUri = getUri(webview, this._extensionUri, ["webview-ui", "build", "assets", "index.css"]);
    // The JS file from the Vue build output
    const scriptUri = getUri(webview, this._extensionUri, ["webview-ui", "build", "assets", "index.js"]);

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
          <title>Hello World</title>
        </head>
        <body>
          <div id="app"></div>
          <script type="module" nonce="${nonce}" src="${scriptUri}"></script>
        </body>
      </html>
    `;
  }

  /**
   * Sets up an event listener to listen for messages passed from the webview context and
   * executes code based on the message that is received.
   *
   * @param webview A reference to the extension webview
   */
  private _setWebviewMessageListener(webview: Webview) {
    webview.onDidReceiveMessage(
      (message: any) => {
        const command = message.command;
        const text = message.text;

        switch (command) {
          case "hello":
            // Code that should run in response to the hello message command
            window.showInformationMessage(text);
            return;
          // Add more switch case statements here as more webview message commands
          // are created within the webview context
        }
      },
      undefined,
      this._disposables
    );
  }
}