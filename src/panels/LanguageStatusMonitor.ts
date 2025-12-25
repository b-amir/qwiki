import { window, workspace, extensions } from "vscode";
import { ServiceLimits } from "@/constants";
import { LoggingService, createLogger, type Logger } from "@/infrastructure/services";

export interface LanguageStatus {
  ready: boolean;
  languageId?: string;
  message: string;
  reason?: string;
  extensions?: string[];
}

export class LanguageStatusMonitor {
  private logger: Logger;
  private _languageStatus: LanguageStatus = {
    ready: true,
    message: "",
    reason: "unknown",
  };
  private _languageStatusInterval: NodeJS.Timeout | undefined;
  private onStatusChange: (status: LanguageStatus) => void;
  private debounceTimer?: NodeJS.Timeout;
  private readonly DEBOUNCE_DELAY_MS = 300;

  constructor(loggingService: LoggingService, onStatusChange: (status: LanguageStatus) => void) {
    this.logger = createLogger("LanguageStatusMonitor");
    this.onStatusChange = onStatusChange;
  }

  startMonitoring(): void {
    const update = () => {
      this.debouncedUpdate();
    };

    window.onDidChangeActiveTextEditor(() => {
      update();
    });
    workspace.onDidOpenTextDocument(() => {
      update();
    });
    workspace.onDidCloseTextDocument(() => {
      update();
    });
    extensions.onDidChange(() => {
      update();
    });

    update();
  }

  private debouncedUpdate(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      void this.updateLanguageServerStatus();
      this.debounceTimer = undefined;
    }, this.DEBOUNCE_DELAY_MS);
  }

  getLanguageStatus(): LanguageStatus {
    return this._languageStatus;
  }

  clearInterval(): void {
    if (!this._languageStatusInterval) {
      return;
    }
    clearInterval(this._languageStatusInterval);
    this._languageStatusInterval = undefined;
  }

  private async updateLanguageServerStatus(): Promise<void> {
    try {
      const editor = window.activeTextEditor;
      if (!editor) {
        const newStatus = {
          ready: true,
          languageId: undefined,
          message: "",
          reason: "no-active-editor",
        };
        if (JSON.stringify(this._languageStatus) !== JSON.stringify(newStatus)) {
          this._languageStatus = newStatus;
          this.onStatusChange(newStatus);
        }
        this.clearInterval();
        return;
      }

      const languageId = editor.document.languageId;
      const relevantExtensions = extensions.all.filter((ext) => {
        const packageJSON = ext.packageJSON as unknown;
        const activationEvents = 
          packageJSON && typeof packageJSON === "object" && "activationEvents" in packageJSON
            ? (packageJSON as { activationEvents: unknown }).activationEvents
            : undefined;
        if (!Array.isArray(activationEvents)) {
          return false;
        }
        return activationEvents.some((event: string) => event === `onLanguage:${languageId}`);
      });

      if (!relevantExtensions.length) {
        const newStatus = {
          ready: true,
          languageId,
          message: `No dedicated language extension detected for ${languageId}.`,
          reason: "no-language-extension",
        };
        if (JSON.stringify(this._languageStatus) !== JSON.stringify(newStatus)) {
          this._languageStatus = newStatus;
          this.onStatusChange(newStatus);
        }
        this.clearInterval();
        return;
      }

      const inactiveExtensions = relevantExtensions.filter((ext) => !ext.isActive);

      if (inactiveExtensions.length === 0) {
        const newStatus = {
          ready: true,
          languageId,
          message: `${languageId} language features ready.`,
          reason: "ready",
          extensions: relevantExtensions.map((ext) => ext.id),
        };
        if (JSON.stringify(this._languageStatus) !== JSON.stringify(newStatus)) {
          this._languageStatus = newStatus;
          this.onStatusChange(newStatus);
        }
        this.clearInterval();
        return;
      }

      const newStatus = {
        ready: false,
        languageId,
        message: `Waiting for ${languageId} language features to load...`,
        reason: "loading",
        extensions: relevantExtensions.map((ext) => ext.id),
      };
      if (JSON.stringify(this._languageStatus) !== JSON.stringify(newStatus)) {
        this._languageStatus = newStatus;
        this.onStatusChange(newStatus);
      }
      this.scheduleInterval();
    } catch (error) {
      this.logger.error("Failed to determine language server status", error);
      const newStatus = {
        ready: false,
        languageId: this._languageStatus.languageId,
        message: "Unable to check language server status.",
        reason: "error",
        extensions: this._languageStatus.extensions,
      };
      if (JSON.stringify(this._languageStatus) !== JSON.stringify(newStatus)) {
        this._languageStatus = newStatus;
        this.onStatusChange(newStatus);
      }
      this.scheduleInterval();
    }
  }

  private scheduleInterval(): void {
    if (this._languageStatusInterval) {
      return;
    }
    this._languageStatusInterval = setInterval(() => {
      void this.updateLanguageServerStatus();
    }, ServiceLimits.languageStatusCheckInterval);
  }
}
