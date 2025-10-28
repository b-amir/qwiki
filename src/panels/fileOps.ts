import { Uri, commands, window, workspace } from "vscode";
import { Messages } from "./messages";
import { MessageTemplates, PathPatterns, PathStrings, VSCodeCommands } from "../constants";

export async function tryOpenFile(path: string, line?: number) {
  try {
    const folders = workspace.workspaceFolders;
    let targetUri: Uri | undefined;
    const cleaned = path.replace(PathPatterns.currentDirRegex, "");
    const isAbs = PathPatterns.absolutePathRegex.test(path);
    const isAlias = PathPatterns.aliasRegex.test(cleaned);
    const aliasRemainder = cleaned.replace(PathPatterns.aliasRegex, "");
    if (isAbs) {
      targetUri = Uri.file(path);
    } else if (folders && folders.length && !isAlias) {
      targetUri = Uri.joinPath(folders[0].uri, cleaned.replace(/^[\\/]+/, ""));
    }
    if (!isAbs && (!targetUri || isAlias) && folders && folders.length) {
      const globs = new Set<string>();
      const base = cleaned.replace(/^.*[\\/]/, "");
      if (isAlias) {
        globs.add(`**/${aliasRemainder}`);
        globs.add(`**/${PathStrings.srcPrefix}${aliasRemainder}`);
      }
      if (PathPatterns.pathSeparatorRegex.test(cleaned)) {
        globs.add(cleaned);
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
    if (!targetUri) {
      window.showWarningMessage(MessageTemplates.cannotResolvePath(path));
      return false;
    }
    await commands.executeCommand(
      VSCodeCommands.open,
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
    return true;
  } catch (e: any) {
    window.showErrorMessage(MessageTemplates.failedToOpenFile(e?.message || String(e)));
    return false;
  }
}
