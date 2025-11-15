import { workspace } from "vscode";
import { join } from "path";
import { LoggingService, createLogger, type Logger } from "@/infrastructure/services";
import { VSCodeFileSystemService } from "@/infrastructure/services";

export class ReadmeFileService {
  private logger: Logger;
  private readonly readmeFileName = "README.md";

  constructor(
    private vscodeFileSystem: VSCodeFileSystemService,
    private loggingService: LoggingService,
  ) {
    this.logger = createLogger("ReadmeFileService");
  }

  async readReadme(): Promise<string> {
    const workspaceRoot = this.getWorkspaceRoot();
    if (!workspaceRoot) {
      return "";
    }

    const readmePath = join(workspaceRoot, this.readmeFileName);

    try {
      return await this.vscodeFileSystem.readFile(readmePath, true);
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

    await this.vscodeFileSystem.writeFile(readmePath, content, true);
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
