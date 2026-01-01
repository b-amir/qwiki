import { commands, window } from "vscode";
import { VSCodeCommandIds, CommandIds } from "@/constants";
import type { AppBootstrap } from "@/application/AppBootstrap";
import type { CommandRegistry } from "@/application/CommandRegistry";
import type { ConfigurationManagerService } from "@/application/services/configuration/ConfigurationManagerService";
import type { WikiGenerationRequest } from "@/domain/entities/Wiki";

export function registerCoreCommands(appBootstrap: AppBootstrap): void {
  commands.registerCommand(VSCodeCommandIds.createQuickWiki, async () => {
    try {
      const editor = window.activeTextEditor;
      if (!editor) {
        window.showWarningMessage("Open a file to generate a wiki.");
        return;
      }

      await commands.executeCommand(VSCodeCommandIds.showPanel);

      const document = editor.document;
      const selection = editor.selection;
      const snippet = document.getText(selection) || document.getText();
      const filePath = document.uri.fsPath;
      const languageId = document.languageId;

      const container = appBootstrap.getContainer();

      const configManager = container.resolve(
        "configurationManager",
      ) as ConfigurationManagerService;
      const globalConfig = await configManager.getGlobalConfig();
      const providerId = globalConfig.defaultProviderId || "google-ai-studio";

      const model = configManager.getCachedModel() || undefined;

      const payload: WikiGenerationRequest = {
        snippet,
        filePath,
        languageId,
        providerId,
        model,
      };

      const commandRegistry = container.resolve("commandRegistry") as CommandRegistry;
      await commandRegistry.execute(CommandIds.generateWiki, payload);
    } catch (error) {
      window.showErrorMessage(`Failed to create quick wiki: ${error}`);
    }
  });
}
