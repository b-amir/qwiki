type LogLevel = "debug" | "info" | "warn" | "error";

export interface FrontendLoggerConfig {
  enabled: boolean;
  level: LogLevel;
  includeTimestamp: boolean;
  includeSource: boolean;
}

const levelWeight: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

class FrontendLogger {
  constructor(
    private config: FrontendLoggerConfig,
    private source: string,
  ) {}

  debug(message: string, data?: unknown) {
    this.log("debug", message, data);
  }

  info(message: string, data?: unknown) {
    this.log("info", message, data);
  }

  warn(message: string, data?: unknown) {
    this.log("warn", message, data);
  }

  error(message: string, data?: unknown) {
    this.log("error", message, data);
  }

  private log(level: LogLevel, message: string, data?: unknown) {
    if (!this.config.enabled || !this.shouldLog(level)) {
      return;
    }

    this.output(level, message, data);
  }

  private shouldLog(level: LogLevel) {
    return levelWeight[level] >= levelWeight[this.config.level];
  }

  private async output(level: LogLevel, message: string, data?: unknown) {
    const formattedMessage = this.formatMessage(message);

    switch (level) {
      case "debug":
        data === undefined
          ? console.debug(formattedMessage)
          : console.debug(formattedMessage, data);
        break;
      case "info":
        data === undefined ? console.info(formattedMessage) : console.info(formattedMessage, data);
        break;
      case "warn":
        data === undefined ? console.warn(formattedMessage) : console.warn(formattedMessage, data);
        break;
      case "error":
      default:
        data === undefined
          ? console.error(formattedMessage)
          : console.error(formattedMessage, data);
        break;
    }

    try {
      import("./vscode")
        .then(({ vscode }) => {
          if (vscode && typeof vscode.postMessage === "function") {
            vscode.postMessage({
              command: "frontendLog",
              payload: {
                source: this.source,
                level,
                message,
                data,
              },
            });
          }
        })
        .catch(() => {});
    } catch {}
  }

  private formatMessage(message: string): string {
    const parts: string[] = [];

    if (this.config.includeTimestamp) {
      parts.push(new Date().toISOString());
    }

    parts.push("qwiki");

    if (this.config.includeSource) {
      parts.push(this.source);
    }

    parts.push(message);

    return parts.join(" | ");
  }
}

const defaultConfig: FrontendLoggerConfig = {
  enabled: true,
  level: "debug",
  includeTimestamp: true,
  includeSource: true,
};

export const createLogger = (source: string, overrides?: Partial<FrontendLoggerConfig>) => {
  return new FrontendLogger({ ...defaultConfig, ...overrides }, source);
};
