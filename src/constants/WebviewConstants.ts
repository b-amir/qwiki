export const WebviewPaths = {
  out: "out",
  webviewBuild: "webview-ui/build",
  assets: "assets",
  indexCss: "index.css",
  indexJs: "index.js",
} as const;

export const WebviewHtml = {
  cspSource: "https://cdn.jsdelivr.net",
  styleTag: `<link rel="stylesheet" type="text/css" href="{{stylesUri}}" />`,
  scriptTag: `<script type="module" src="{{scriptUri}}"></script>`,
} as const;
