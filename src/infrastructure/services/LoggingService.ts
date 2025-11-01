type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  service: string;
  message: string;
  data?: unknown;
}

export interface LoggerConfig {
  enabled: boolean;
  level: LogLevel;
  includeTimestamp: boolean;
  includeService: boolean;
}

const levelOrder: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

export class LoggingService {
  constructor(private config: LoggerConfig) {}

  debug(service: string, message: string, data?: unknown): void {
    this.log({ timestamp: new Date(), level: "debug", service, message, data });
  }

  info(service: string, message: string, data?: unknown): void {
    this.log({ timestamp: new Date(), level: "info", service, message, data });
  }

  warn(service: string, message: string, data?: unknown): void {
    this.log({ timestamp: new Date(), level: "warn", service, message, data });
  }

  error(service: string, message: string, data?: unknown): void {
    this.log({ timestamp: new Date(), level: "error", service, message, data });
  }

  private log(entry: LogEntry): void {
    if (!this.config.enabled || !this.shouldLog(entry.level)) {
      return;
    }

    const parts: string[] = [];

    if (this.config.includeTimestamp) {
      parts.push(entry.timestamp.toISOString());
    }

    if (this.config.includeService) {
      parts.push(entry.service);
    }

    parts.push(entry.message);

    const payload = parts.join(" | ");

    if (entry.data === undefined) {
      this.output(entry.level, payload);
      return;
    }

    this.output(entry.level, payload, entry.data);
  }

  private shouldLog(level: LogLevel): boolean {
    return levelOrder[level] >= levelOrder[this.config.level];
  }

  private output(level: LogLevel, message: string, data?: unknown): void {
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
