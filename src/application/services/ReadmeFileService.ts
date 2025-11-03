import { workspace, Uri } from "vscode";
import { join } from "path";
import {
  LoggingService,
  createLogger,
  type Logger,
} from "../../infrastructure/services/LoggingService";

export class ReadmeFileService {
  private logger: Logger;
  private readonly readmeFileName = "README.md";

  constructor(private loggingService: LoggingService) {
    this.logger = createLogger("ReadmeFileService", loggingService);
  }

  async readReadme(): Promise<string> {
    const workspaceRoot = this.getWorkspaceRoot();
    if (!workspaceRoot) {
      return "";
    }

    const readmePath = join(workspaceRoot, this.readmeFileName);
    const readmeUri = Uri.file(readmePath);

    try {
      const content = await workspace.fs.readFile(readmeUri);
      return Buffer.from(content).toString("utf8");
    } catch {
      return "";
    }
  }

  async writeReadme(content: string): Promise<void> {
    const workspaceRoot = this.getWorkspaceRoot();
    if (!workspaceRoot) {
      throw new Error("No workspace root found");
    }

    const readmePath = join(workspaceRoot, this.readmeFileName);
    const readmeUri = Uri.file(readmePath);

    await workspace.fs.writeFile(readmeUri, Buffer.from(content, "utf8"));
  }

  getReadmePath(): string | undefined {
    const workspaceRoot = this.getWorkspaceRoot();
    if (!workspaceRoot) {
      return undefined;
    }
    return join(workspaceRoot, this.readmeFileName);
  }

  private getWorkspaceRoot(): string | undefined {
    const workspaceFolders = workspace.workspaceFolders;
    return workspaceFolders?.[0]?.uri.fsPath;
  }
}
