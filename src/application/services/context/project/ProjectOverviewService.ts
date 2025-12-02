import { workspace } from "vscode";
import { LoggingService, createLogger, type Logger } from "@/infrastructure/services";
import { FilePatterns, FileLimits, MessageStrings, MessageFormats } from "@/constants";

export class ProjectOverviewService {
  private logger: Logger;

  constructor(private loggingService: LoggingService) {
    this.logger = createLogger("ProjectOverviewService");
  }

  async readOverview(): Promise<string> {
    const startTime = Date.now();
    this.logger.debug("readOverview started");

    try {
      const findPkgStart = Date.now();
      this.logger.debug("Finding package.json files");
      const pkgUris = await workspace.findFiles(
        FilePatterns.packageJson,
        FilePatterns.excludeWithoutVscode,
        1,
      );
      this.logger.debug("Package.json search completed", {
        duration: Date.now() - findPkgStart,
        found: pkgUris.length > 0,
        path: pkgUris[0]?.fsPath,
      });

      if (!pkgUris.length) {
        this.logger.debug("No package.json found, returning empty overview");
        return "";
      }

      const readDocStart = Date.now();
      this.logger.debug("Reading package.json");
      const doc = await workspace.openTextDocument(pkgUris[0]);
      const json = JSON.parse(doc.getText());
      this.logger.debug("Package.json parsed", {
        duration: Date.now() - readDocStart,
        hasName: !!json.name,
        depCount: Object.keys(json.dependencies || {}).length,
        devDepCount: Object.keys(json.devDependencies || {}).length,
      });

      const name = json.name as string | undefined;
      const deps = json.dependencies
        ? Object.keys(json.dependencies).slice(0, FileLimits.maxDependencies)
        : [];
      const devDeps = json.devDependencies
        ? Object.keys(json.devDependencies).slice(0, FileLimits.maxDevDependencies)
        : [];

      this.logger.debug("Extracted package info", {
        name,
        depCount: deps.length,
        devDepCount: devDeps.length,
        totalDeps: Object.keys(json.dependencies || {}).length,
        totalDevDeps: Object.keys(json.devDependencies || {}).length,
      });

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

      const overview = MessageFormats.overview(parts);
      this.logger.debug("readOverview completed", {
        totalDuration: Date.now() - startTime,
        overviewLength: overview.length,
        partCount: parts.length,
      });
      return overview;
    } catch (error: unknown) {
      const errObj = error as Record<string, unknown> | null;
      this.logger.debug("readOverview failed", {
        totalDuration: Date.now() - startTime,
        error: errObj?.message,
      });
      return "";
    }
  }
}
