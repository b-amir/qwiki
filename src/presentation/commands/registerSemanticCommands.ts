import { commands, window } from "vscode";
import { VSCodeCommandIds } from "@/constants";
import type { AppBootstrap } from "@/application/AppBootstrap";
import type { CommandRegistry } from "@/application/CommandRegistry";

export function registerSemanticCommands(appBootstrap: AppBootstrap): void {
  commands.registerCommand(VSCodeCommandIds.toggleSemanticCaching, async () => {
    try {
      const commandRegistry = appBootstrap
        .getContainer()
        .resolve("commandRegistry") as CommandRegistry;

      const commands = appBootstrap.getContainer().resolve("commands") as Record<string, any>;
      const toggleCommand = commands.toggleSemanticCaching;

      if (!toggleCommand) {
        window.showErrorMessage("Toggle semantic caching command not found");
        return;
      }

      const status = await toggleCommand.execute();

      const message = status.enabled
        ? `Semantic caching enabled (threshold: ${status.threshold}, max: ${status.maxEntries})`
        : "Semantic caching disabled";

      window.showInformationMessage(`Qwiki: ${message}`);
    } catch (error) {
      window.showErrorMessage(`Failed to toggle semantic caching: ${error}`);
    }
  });

  commands.registerCommand(VSCodeCommandIds.viewCacheStatistics, async () => {
    try {
      const commands = appBootstrap.getContainer().resolve("commands") as Record<string, any>;
      const statsCommand = commands.getCacheStatistics;

      if (!statsCommand) {
        window.showErrorMessage("Get cache statistics command not found");
        return;
      }

      const stats = await statsCommand.execute();

      const outputChannel = window.createOutputChannel("Qwiki Cache Statistics");
      outputChannel.clear();
      outputChannel.appendLine("=== Qwiki Cache Statistics ===");
      outputChannel.appendLine("");
      outputChannel.appendLine(`Semantic Caching: ${stats.enabled ? "Enabled" : "Disabled"}`);
      outputChannel.appendLine(`Cache Hit Rate: ${stats.estimatedHitRate.toFixed(1)}%`);
      outputChannel.appendLine(`Total Cache Size: ${stats.totalCacheSize} entries`);

      if (stats.semanticCacheStats) {
        outputChannel.appendLine("");
        outputChannel.appendLine("Semantic Cache Details:");
        outputChannel.appendLine(`  Total Entries: ${stats.semanticCacheStats.totalEntries}`);
        outputChannel.appendLine(
          `  Average Access Count: ${stats.semanticCacheStats.averageAccessCount.toFixed(2)}`,
        );
      }

      outputChannel.show();
    } catch (error) {
      window.showErrorMessage(`Failed to get cache statistics: ${error}`);
    }
  });

  commands.registerCommand(VSCodeCommandIds.viewMetricsDashboard, async () => {
    try {
      const commands = appBootstrap.getContainer().resolve("commands") as Record<string, any>;
      const metricsCommand = commands.getAllMetrics;

      if (!metricsCommand) {
        window.showErrorMessage("Get all metrics command not found");
        return;
      }

      const metrics = await metricsCommand.execute();

      const outputChannel = window.createOutputChannel("Qwiki Metrics Dashboard");
      outputChannel.clear();
      outputChannel.appendLine("=== Qwiki Metrics Dashboard ===");
      outputChannel.appendLine("");

      outputChannel.appendLine("📊 PERFORMANCE");
      outputChannel.appendLine(`  Total Requests: ${metrics.performance.totalRequests}`);
      outputChannel.appendLine(
        `  Avg Response Time: ${metrics.performance.averageResponseTime.toFixed(2)}ms`,
      );
      outputChannel.appendLine(
        `  Error Rate: ${(metrics.performance.errorRate * 100).toFixed(1)}%`,
      );
      if (metrics.performance.slowestEndpoint) {
        outputChannel.appendLine(`  Slowest Operation: ${metrics.performance.slowestEndpoint}`);
      }

      outputChannel.appendLine("");
      outputChannel.appendLine("✨ QUALITY");
      outputChannel.appendLine(
        `  Average Quality Score: ${(metrics.quality.averageQualityScore * 100).toFixed(1)}%`,
      );
      outputChannel.appendLine(`  Total Generations: ${metrics.quality.totalGenerations}`);
      outputChannel.appendLine(`  Trend: ${metrics.quality.qualityTrend.toUpperCase()}`);

      outputChannel.appendLine("");
      outputChannel.appendLine("👤 USER EXPERIENCE");
      outputChannel.appendLine(`  Average Load Time: ${metrics.ux.averageLoadTime.toFixed(2)}ms`);
      outputChannel.appendLine(`  User Interactions: ${metrics.ux.userInteractions}`);
      outputChannel.appendLine(`  Error Count: ${metrics.ux.errorCount}`);

      outputChannel.appendLine("");
      outputChannel.appendLine(`Last Updated: ${new Date(metrics.timestamp).toLocaleString()}`);

      outputChannel.show();
    } catch (error) {
      window.showErrorMessage(`Failed to get metrics: ${error}`);
    }
  });

  commands.registerCommand(VSCodeCommandIds.semanticSearch, async () => {
    try {
      const editor = window.activeTextEditor;
      const searchText =
        editor?.document.getText(editor.selection) ||
        (await window.showInputBox({
          prompt: "Enter text to search semantically",
          placeHolder: "function authenticate() { ... }",
          value: "",
        }));

      if (!searchText) {
        return;
      }

      window.showInformationMessage(
        "Semantic search functionality coming soon! Selected text length: " + searchText.length,
      );

      // TODO: Implement full semantic search with EmbeddingService
      // This requires creating a new command in the application layer
    } catch (error) {
      window.showErrorMessage(`Semantic search failed: ${error}`);
    }
  });
}
