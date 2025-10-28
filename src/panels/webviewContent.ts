import { Webview, Uri } from "vscode";
import { getUri } from "../utilities/getUri";
import { getNonce } from "../utilities/getNonce";
import { WebviewPaths } from "../constants";

export function getWebviewHtml(webview: Webview, extensionUri: Uri) {
  const stylesUri = getUri(webview, extensionUri, [
    WebviewPaths.webviewBuild,
    WebviewPaths.assets,
    WebviewPaths.indexCss,
  ]);
  const scriptUri = getUri(webview, extensionUri, [
    WebviewPaths.webviewBuild,
    WebviewPaths.assets,
    WebviewPaths.indexJs,
  ]);
  const nonce = getNonce();
  return `
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
