# Qwiki

![Qwiki Preview](resources/preview-icon.png)

Qwiki is a VS Code extension that provides a quick wiki interface directly in your editor. It uses Vue.js for a modern and responsive webview UI that integrates seamlessly with your development workflow.

## Features

- **Integrated WebView Panel**: Access Qwiki directly from the VS Code activity bar
- **Modern UI**: Built with Vue.js and VS Code's webview UI toolkit for a native look and feel
- **Real-time Communication**: Bidirectional messaging between the extension and webview
- **TypeScript Support**: Fully typed for better development experience

## Project Structure

```
qwiki/
├── src/                      # Extension source code
│   ├── extension.ts          # Main extension entry point
│   ├── panels/               # WebView panel implementations
│   │   └── QwikiPanel.ts
│   ├── utilities/            # Helper functions
│   │   ├── getNonce.ts
│   │   └── getUri.ts
│   └── test/                 # Extension tests
├── webview-ui/               # Vue.js webview application
│   ├── src/
│   │   ├── App.vue           # Main Vue component
│   │   ├── main.ts           # Vue app entry point
│   │   └── utilities/
│   │       └── vscode.ts     # VS Code API bridge
│   ├── package.json          # Webview dependencies
│   └── vite.config.ts        # Vite build configuration
├── resources/                # Extension resources
│   ├── preview-icon.png      # Preview icon for documentation
│   └── qwiki-icon.svg        # Activity bar icon
├── package.json              # Extension manifest and dependencies
├── tsconfig.json             # TypeScript configuration
└── webpack.config.js         # Extension build configuration
```

## Installation

### From Source

1. Clone this repository:

```bash
git clone <repository-url>
cd qwiki
```

2. Install dependencies:

```bash
pnpm run install:all
```

3. Build the webview UI:

```bash
pnpm run build:webview
```

4. Compile the extension:

```bash
pnpm run compile
```

5. Open in VS Code and press F5 to run the extension in a new Extension Development Host window.

## Usage

### Accessing Qwiki

1. Open VS Code
2. Look for the Qwiki icon in the activity bar (usually on the left side)
3. Click on the Qwiki icon to open the webview panel

### Using the Interface

The Qwiki webview provides a simple interface with interactive elements. Click the "Howdy!" button to see an example of communication between the webview and the extension.

## Development

### Running in Development Mode

1. Install dependencies:

```bash
pnpm run install:all
```

2. Start the webview development server:

```bash
pnpm run start:webview
```

3. In another terminal, compile the extension in watch mode:

```bash
pnpm run watch
```

4. Press F5 in VS Code to launch the extension in debug mode.

### Building for Production

1. Build the webview:

```bash
pnpm run build:webview
```

2. Compile the extension:

```bash
pnpm run vscode:prepublish
```

### Extension Structure

- **Extension Entry Point** (`src/extension.ts`): Registers the webview provider and commands
- **WebView Panel** (`src/panels/HelloWorldPanel.ts`): Manages the webview lifecycle and communication
- **Vue App** (`webview-ui/src/App.vue`): The UI displayed in the webview
- **VS Code Bridge** (`webview-ui/src/utilities/vscode.ts`): Handles communication with the extension

## Requirements

- Visual Studio Code 1.105.0 or higher
- Node.js and pnpm for development

## Extension Settings

This extension currently doesn't contribute any VS Code settings.

## Release Notes

### 0.0.1

Initial release of Qwiki extension with basic webview functionality.

## For more information

- [Visual Studio Code's Extension API](https://code.visualstudio.com/api)
- [Visual Studio Code's Markdown Support](http://code.visualstudio.com/docs/languages/markdown)
- [Markdown Syntax Reference](https://help.github.com/articles/markdown-basics/)

**Enjoy!**
