import { Uri, commands, window, workspace } from "vscode";
import {
  MessageTemplates,
  MessageStrings,
  PathPatterns,
  PathStrings,
  VSCodeCommands,
} from "@/constants";
import { PathSanitizer } from "@/utilities/pathSanitizer";

export async function tryOpenFile(path: string, line?: number) {
  try {
    if (!path || typeof path !== "string") {
      window.showWarningMessage(MessageTemplates.cannotResolvePath(String(path || "")));
      return false;
    }

    const sanitizationResult = PathSanitizer.sanitizePath(path);
    if (!sanitizationResult.isValid) {
      window.showWarningMessage(`Invalid file path: ${sanitizationResult.warnings.join(", ")}`);
      return false;
    }
    path = sanitizationResult.sanitized;
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

      const excludePattern = "**/{node_modules,dist,out,build,.git,.vscode}/**";
      const fileSearchPromises = Array.from(globs).map((glob) =>
        workspace.findFiles(glob, excludePattern, 5),
      );

      const searchResults = await Promise.all(fileSearchPromises);

      for (const matches of searchResults) {
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
