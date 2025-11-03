import { window, OutputChannel } from "vscode";
import { LogSanitizer } from "./LogSanitizer";

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

export interface LogOutput {
  write(entry: LogEntry): void;
}

export interface LogFormatter {
  format(entry: LogEntry): string;
}

const levelOrder: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

class ConsoleOutput implements LogOutput {
  constructor(private formatter: LogFormatter) {}

  write(entry: LogEntry): void {
    const message = this.formatter.format(entry);
    if (entry.data === undefined) {
      this.consoleMethod(entry.level)(message);
    } else {
      this.consoleMethod(entry.level)(message, entry.data);
    }
  }

  private consoleMethod(level: LogLevel): typeof console.debug {
    switch (level) {
      case "debug":
        return console.debug.bind(console);
      case "info":
        return console.info.bind(console);
      case "warn":
        return console.warn.bind(console);
      case "error":
      default:
        return console.error.bind(console);
    }
  }
}

class OutputChannelOutput implements LogOutput {
  private outputChannel: OutputChannel;

  constructor(
    private formatter: LogFormatter,
    channelName: string = "Qwiki",
  ) {
    this.outputChannel = window.createOutputChannel(channelName);
  }

  write(entry: LogEntry): void {
    const formatted = this.formatter.format(entry);
    this.outputChannel.appendLine(formatted);

    if (entry.data !== undefined) {
      this.outputChannel.appendLine(`  Data: ${JSON.stringify(entry.data, null, 2)}`);
    }

    if (entry.level === "error") {
      this.outputChannel.show(true);
    }
  }

  dispose(): void {
    this.outputChannel.dispose();
  }
}

class DefaultFormatter implements LogFormatter {
  constructor(private config: LoggerConfig) {}

  format(entry: LogEntry): string {
    const parts: string[] = [];

    if (this.config.includeTimestamp) {
      parts.push(entry.timestamp.toISOString());
    }

    parts.push("qwiki");

    if (this.config.includeService) {
      parts.push(entry.service);
    }

    parts.push(entry.message);

    return parts.join(" | ");
  }
}

export class LoggingService {
  private outputs: LogOutput[] = [];
  private formatter: LogFormatter;
  private outputChannelOutput?: OutputChannelOutput;

  constructor(
    private config: LoggerConfig,
    outputs?: LogOutput[],
    formatter?: LogFormatter,
    enableOutputChannel: boolean = true,
  ) {
    this.formatter = formatter || new DefaultFormatter(config);
    this.outputs = outputs || [new ConsoleOutput(this.formatter)];

    if (enableOutputChannel) {
      this.outputChannelOutput = new OutputChannelOutput(this.formatter);
      this.outputs.push(this.outputChannelOutput);
    }
  }

  addOutput(output: LogOutput): void {
    this.outputs.push(output);
  }

  debug(service: string, message: string, data?: unknown): void {
    if (!this.shouldLog("debug")) {
      return;
    }
    this.log({ timestamp: new Date(), level: "debug", service, message, data });
  }

  info(service: string, message: string, data?: unknown): void {
    if (!this.shouldLog("info")) {
      return;
    }
    this.log({ timestamp: new Date(), level: "info", service, message, data });
  }

  warn(service: string, message: string, data?: unknown): void {
    if (!this.shouldLog("warn")) {
      return;
    }
    this.log({ timestamp: new Date(), level: "warn", service, message, data });
  }

  error(service: string, message: string, data?: unknown): void {
    if (!this.shouldLog("error")) {
      return;
    }
    this.log({ timestamp: new Date(), level: "error", service, message, data });
  }

  updateConfig(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config };
    if (this.formatter instanceof DefaultFormatter) {
      this.formatter = new DefaultFormatter(this.config);
    }
  }

  private log(entry: LogEntry): void {
    if (!this.config.enabled) {
      return;
    }

    const sanitizedEntry: LogEntry = {
      ...entry,
      data: entry.data ? LogSanitizer.sanitizeData(entry.data) : undefined,
    };

    for (const output of this.outputs) {
      try {
        output.write(sanitizedEntry);
      } catch (error) {
        try {
          console.error("Log output failed:", error);
        } catch {}
      }
    }
  }

  private shouldLog(level: LogLevel): boolean {
    if (!this.config.enabled) {
      return false;
    }
    return levelOrder[level] >= levelOrder[this.config.level];
  }

  dispose(): void {
    if (this.outputChannelOutput) {
      this.outputChannelOutput.dispose();
      this.outputChannelOutput = undefined;
    }
  }
}

export function createLogger(serviceName: string, loggingService: LoggingService) {
  return {
    debug: (message: string, data?: unknown) => loggingService.debug(serviceName, message, data),
    info: (message: string, data?: unknown) => loggingService.info(serviceName, message, data),
    warn: (message: string, data?: unknown) => loggingService.warn(serviceName, message, data),
    error: (message: string, data?: unknown) => loggingService.error(serviceName, message, data),
  };
}

export type Logger = ReturnType<typeof createLogger>;
