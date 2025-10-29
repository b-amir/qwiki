import { Uri, Webview, workspace } from "vscode";
import { OutboundEvents, LoadingSteps } from "../../constants";
import {
  FilePatterns,
  FileLimits,
  PathPatterns,
  MessageStrings,
  MessageFormats,
} from "../../constants";
import type { Selection, ProjectContext } from "../../domain/entities/Selection";

export class ProjectContextService {
  async buildContext(
    snippet: string,
    filePath?: string,
    languageId?: string,
    webview?: Webview,
  ): Promise<ProjectContext> {
    const folders = workspace.workspaceFolders;
    const rootName = folders && folders.length ? folders[0].name : "";
    const files = await workspace.findFiles(
      FilePatterns.allFiles,
      FilePatterns.exclude,
      FileLimits.projectFiles,
    );
    const filesSample = files.slice(0, FileLimits.maxFileSample).map(this.relativePath);
    const overview = await this.readOverview();
    if (webview)
      webview.postMessage({
        command: OutboundEvents.loadingStep,
        payload: { step: LoadingSteps.finding },
      });
    const token = this.extractIdentifier(snippet) || this.baseName(filePath);
    const related = token ? await this.findTextUsages(token) : [];
    return { rootName, overview, filesSample, related };
  }

  private baseName(p?: string) {
    if (!p || typeof p !== "string") return undefined;
    const m = PathPatterns.baseNameRegex.exec(p);
    return m ? m[0] : p;
  }

  private relativePath(u: Uri) {
    const folders = workspace.workspaceFolders;
    if (!folders || !folders.length) return u.fsPath;
    const root = folders[0].uri.fsPath.replace(PathPatterns.escapeCharRegex, "");
    const fsPath = u.fsPath || "";
    return fsPath.startsWith(root) ? fsPath.slice(root.length + 1) : fsPath;
  }

  private extractIdentifier(text: string) {
    if (!text || typeof text !== "string") return undefined;
    const matches = text.match(PathPatterns.identifierRegex);
    if (!matches || !matches.length) return undefined;
    const scored = matches.map((t) => ({ t, score: (/[A-Z]/.test(t) ? 1 : 0) + t.length / 10 }));
    scored.sort((a, b) => b.score - a.score);
    return scored[0].t;
  }

  private async findTextUsages(token: string) {
    const related: Array<{ path: string; preview?: string; line?: number; reason?: string }> = [];
    const files = await workspace.findFiles(
      FilePatterns.allFiles,
      FilePatterns.exclude,
      FileLimits.relatedFiles,
    );
    const re = new RegExp(
      `${PathPatterns.wordBoundaryRegex}${(token || "").replace(PathPatterns.specialCharsRegex, "\\$&")}${PathPatterns.wordBoundaryRegex}`,
    );

    const filePromises = files.map(async (uri) => {
      try {
        const doc = await workspace.openTextDocument(uri);
        const text = doc.getText();
        const m = re.exec(text);
        if (!m) return null;
        const pos = doc.positionAt(m.index);
        const line = pos.line + 1;
        const previewLine = doc.lineAt(pos.line).text.trim();
        return {
          path: this.relativePath(uri),
          line,
          preview: previewLine,
          reason: MessageStrings.textMatch,
        };
      } catch (error) {
        console.error("[QWIKI] ProjectContextService: Exception in findTextUsages:", error);
        return null;
      }
    });

    const results = await Promise.all(filePromises);

    const validResults = results.filter(
      (result): result is NonNullable<typeof result> => result !== null,
    );
    related.push(...validResults.slice(0, FileLimits.maxRelatedResults));

    return related;
  }

  private async readOverview() {
    try {
      const pkgUris = await workspace.findFiles(
        FilePatterns.packageJson,
        FilePatterns.excludeWithoutVscode,
        1,
      );
      if (!pkgUris.length) return "";
      const doc = await workspace.openTextDocument(pkgUris[0]);
      const json = JSON.parse(doc.getText());
      const name = json.name as string | undefined;
      const deps = json.dependencies
        ? Object.keys(json.dependencies).slice(0, FileLimits.maxDependencies)
        : [];
      const devDeps = json.devDependencies
        ? Object.keys(json.devDependencies).slice(0, FileLimits.maxDevDependencies)
        : [];
      const parts = [] as string[];
      if (name) parts.push(`${MessageStrings.package}: ${name}`);
      if (deps.length)
        parts.push(
          `${MessageStrings.deps}: ${MessageFormats.dependencies(deps, json.dependencies && Object.keys(json.dependencies).length > deps.length)}`,
        );
      if (devDeps.length)
        parts.push(
          `${MessageStrings.devDeps}: ${MessageFormats.dependencies(devDeps, json.devDependencies && Object.keys(json.devDependencies).length > devDeps.length)}`,
        );
      return MessageFormats.overview(parts);
    } catch {
      return "";
    }
  }
}
