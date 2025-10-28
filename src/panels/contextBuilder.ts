import { Uri, Webview, workspace } from "vscode";
import { Outbound, LoadingStep } from "./constants";

type ProjectContext = {
  rootName?: string;
  overview: string;
  filesSample: string[];
  related: Array<{ path: string; preview?: string; line?: number; reason?: string }>;
};

export async function buildProjectContext(
  snippet: string,
  filePath?: string,
  languageId?: string,
  webview?: Webview,
): Promise<ProjectContext> {
  const folders = workspace.workspaceFolders;
  const rootName = folders && folders.length ? folders[0].name : undefined;
  const files = await workspace.findFiles(
    "**/*",
    "**/{node_modules,dist,out,build,.git,.vscode}/**",
    200,
  );
  const filesSample = files.slice(0, 50).map(relativePath);
  const overview = await readOverview();
  if (webview)
    webview.postMessage({ command: Outbound.loadingStep, payload: { step: LoadingStep.finding } });
  const token = extractIdentifier(snippet) || baseName(filePath);
  const related = token ? await findTextUsages(token) : [];
  return { rootName, overview, filesSample, related };
}

function baseName(p?: string) {
  if (!p) return undefined;
  const m = /[^\\\/]+$/.exec(p);
  return m ? m[0] : p;
}

function relativePath(u: Uri) {
  const folders = workspace.workspaceFolders;
  if (!folders || !folders.length) return u.fsPath;
  const root = folders[0].uri.fsPath.replace(/\\+$/, "");
  return u.fsPath.startsWith(root) ? u.fsPath.slice(root.length + 1) : u.fsPath;
}

function extractIdentifier(text: string) {
  const matches = text.match(/[A-Za-z_][A-Za-z0-9_\-]*/g);
  if (!matches || !matches.length) return undefined;
  const scored = matches.map((t) => ({ t, score: (/[A-Z]/.test(t) ? 1 : 0) + t.length / 10 }));
  scored.sort((a, b) => b.score - a.score);
  return scored[0].t;
}

async function findTextUsages(token: string) {
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
      related.push({ path: relativePath(uri), line, preview: previewLine, reason: "text match" });
      if (related.length >= 50) break;
    } catch {}
  }
  return related;
}

async function readOverview() {
  try {
    const pkgUris = await workspace.findFiles(
      "package.json",
      "**/{node_modules,dist,out,build}/**",
      1,
    );
    if (!pkgUris.length) return "";
    const doc = await workspace.openTextDocument(pkgUris[0]);
    const json = JSON.parse(doc.getText());
    const name = json.name as string | undefined;
    const deps = json.dependencies ? Object.keys(json.dependencies).slice(0, 10) : [];
    const devDeps = json.devDependencies ? Object.keys(json.devDependencies).slice(0, 5) : [];
    const parts = [] as string[];
    if (name) parts.push(`package: ${name}`);
    if (deps.length)
      parts.push(
        `deps: ${deps.join(", ")}${json.dependencies && Object.keys(json.dependencies).length > deps.length ? "." : ""}`,
      );
    if (devDeps.length)
      parts.push(
        `devDeps: ${devDeps.join(", ")}${json.devDependencies && Object.keys(json.devDependencies).length > devDeps.length ? "." : ""}`,
      );
    return parts.join("; ");
  } catch {
    return "";
  }
}
