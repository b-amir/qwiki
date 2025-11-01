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
  constructor(private config: FrontendLoggerConfig, private source: string) {}

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

    const parts: string[] = [];

    if (this.config.includeTimestamp) {
      parts.push(new Date().toISOString());
    }

    if (this.config.includeSource) {
      parts.push(this.source);
    }

    parts.push(message);
    const payload = parts.join(" | ");

    if (data === undefined) {
      this.output(level, payload);
      return;
    }

    this.output(level, payload, data);
  }

  private shouldLog(level: LogLevel) {
    return levelWeight[level] >= levelWeight[this.config.level];
  }

  private output(level: LogLevel, message: string, data?: unknown) {
    switch (level) {
      case "debug":
        data === undefined ? console.debug(message) : console.debug(message, data);
        break;
      case "info":
        data === undefined ? console.info(message) : console.info(message, data);
        break;
      case "warn":
        data === undefined ? console.warn(message) : console.warn(message, data);
        break;
      case "error":
      default:
        data === undefined ? console.error(message) : console.error(message, data);
        break;
    }
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
