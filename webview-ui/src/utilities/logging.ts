type LogLevel = "debug" | "info" | "warn" | "error";

export type LogMode = "normal" | "verbose";

interface FrontendLoggerConfig {
  mode: LogMode;
  includeTimestamp: boolean;
  includeSource: boolean;
}

const levelWeight: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const defaultConfig: FrontendLoggerConfig = {
  mode: "normal",
  includeTimestamp: true,
  includeSource: true,
};

function getLogLevelForMode(mode: LogMode): LogLevel {
  switch (mode) {
    case "verbose":
      return "debug";
    case "normal":
    default:
      return "warn";
  }
}

function isLoggingEnabled(): boolean {
  return true;
}

export class FrontendLoggingService {
  private static instance: FrontendLoggingService;
  private config: FrontendLoggerConfig;

  static getInstance(): FrontendLoggingService {
    if (!FrontendLoggingService.instance) {
      FrontendLoggingService.instance = new FrontendLoggingService(defaultConfig);
    }
    return FrontendLoggingService.instance;
  }

  static setInstance(service: FrontendLoggingService): void {
    FrontendLoggingService.instance = service;
  }

  constructor(config: FrontendLoggerConfig) {
    this.config = config;
  }

  updateConfig(config: Partial<FrontendLoggerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  log(level: LogLevel, service: string, message: string, data?: unknown): void {
    if (!isLoggingEnabled() || !this.shouldLog(level)) {
      return;
    }

    const formattedMessage = this.formatMessage(service, message);
    this.outputToConsole(level, formattedMessage, data);
    this.forwardToBackend(level, service, message, data);
  }

  private shouldLog(level: LogLevel): boolean {
    const minLevel = getLogLevelForMode(this.config.mode);
    return levelWeight[level] >= levelWeight[minLevel];
  }

  setMode(mode: LogMode): void {
    this.config.mode = mode;
  }

  getMode(): LogMode {
    return this.config.mode;
  }

  private formatMessage(service: string, message: string): string {
    const parts: string[] = [];

    if (this.config.includeTimestamp) {
      parts.push(new Date().toISOString());
    }

    parts.push("qwiki");

    if (this.config.includeSource) {
      parts.push(service);
    }

    parts.push(message);

    return parts.join(" | ");
  }

  private outputToConsole(level: LogLevel, formattedMessage: string, data?: unknown): void {
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
  }

  private forwardToBackend(
    level: LogLevel,
    service: string,
    message: string,
    data?: unknown,
  ): void {
    setTimeout(() => {
      try {
        import("./vscode")
          .then(({ vscode }) => {
            if (vscode && typeof vscode.postMessage === "function") {
              vscode.postMessage({
                command: "frontendLog",
                payload: {
                  level,
                  source: service,
                  message,
                  data,
                },
              });
            }
          })
          .catch(() => {});
      } catch {}
    }, 0);
  }
}

export function createLogger(serviceName: string) {
  const service = FrontendLoggingService.getInstance();
  return {
    debug: (message: string, data?: unknown) => service.log("debug", serviceName, message, data),
    info: (message: string, data?: unknown) => service.log("info", serviceName, message, data),
    warn: (message: string, data?: unknown) => service.log("warn", serviceName, message, data),
    error: (message: string, data?: unknown) => service.log("error", serviceName, message, data),
  };
}

export type Logger = ReturnType<typeof createLogger>;
