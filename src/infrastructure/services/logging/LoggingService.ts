import { window, OutputChannel } from "vscode";
import { LogSanitizer } from "@/infrastructure/services/logging/LogSanitizer";

type LogLevel = "debug" | "info" | "warn" | "error";

export type LogMode = "normal" | "verbose";

export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  service: string;
  message: string;
  data?: unknown;
}

export interface LoggerConfig {
  mode: LogMode;
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

function getDefaultMode(): LogMode {
  const envMode = process.env.LOG_MODE?.toLowerCase();
  return envMode === "verbose" ? "verbose" : "normal";
}

const defaultConfig: LoggerConfig = {
  mode: getDefaultMode(),
  includeTimestamp: true,
  includeService: true,
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

  show(): void {
    this.outputChannel.show(true);
  }

  hide(): void {
    this.outputChannel.hide();
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
  private static instance: LoggingService;
  private outputs: LogOutput[] = [];
  private formatter: LogFormatter;
  private outputChannelOutput?: OutputChannelOutput;
  private outputChannelVisible: boolean = false;
  private config: LoggerConfig;

  static getInstance(): LoggingService {
    if (!LoggingService.instance) {
      LoggingService.instance = new LoggingService();
    }
    return LoggingService.instance;
  }

  static setInstance(service: LoggingService): void {
    LoggingService.instance = service;
  }

  constructor(
    config: Partial<LoggerConfig> = {},
    outputs?: LogOutput[],
    formatter?: LogFormatter,
    enableOutputChannel: boolean = true,
  ) {
    this.config = { ...defaultConfig, ...config };
    this.formatter = formatter || new DefaultFormatter(this.config);
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
    if (!isLoggingEnabled() || !this.shouldLog("debug")) {
      return;
    }
    this.log({ timestamp: new Date(), level: "debug", service, message, data });
  }

  info(service: string, message: string, data?: unknown): void {
    if (!isLoggingEnabled() || !this.shouldLog("info")) {
      return;
    }
    this.log({ timestamp: new Date(), level: "info", service, message, data });
  }

  warn(service: string, message: string, data?: unknown): void {
    if (!isLoggingEnabled() || !this.shouldLog("warn")) {
      return;
    }
    this.log({ timestamp: new Date(), level: "warn", service, message, data });
  }

  error(service: string, message: string, data?: unknown): void {
    if (!isLoggingEnabled() || !this.shouldLog("error")) {
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

  setMode(mode: LogMode): void {
    this.config.mode = mode;
  }

  getMode(): LogMode {
    return this.config.mode;
  }

  private log(entry: LogEntry): void {
    for (const output of this.outputs) {
      try {
        const sanitizedEntry: LogEntry = {
          ...entry,
          data: entry.data ? LogSanitizer.sanitizeData(entry.data) : undefined,
        };
        output.write(sanitizedEntry);
      } catch (error) {
        try {
          console.error("Log output failed:", error);
        } catch {}
      }
    }
  }

  private shouldLog(level: LogLevel): boolean {
    const minLevel = getLogLevelForMode(this.config.mode);
    return levelOrder[level] >= levelOrder[minLevel];
  }

  showOutputChannel(): void {
    if (this.outputChannelOutput) {
      this.outputChannelOutput.show();
      this.outputChannelVisible = true;
    }
  }

  hideOutputChannel(): void {
    if (this.outputChannelOutput) {
      this.outputChannelOutput.hide();
      this.outputChannelVisible = false;
    }
  }

  toggleOutputChannel(): void {
    if (this.outputChannelOutput) {
      if (this.outputChannelVisible) {
        this.outputChannelOutput.hide();
        this.outputChannelVisible = false;
      } else {
        this.outputChannelOutput.show();
        this.outputChannelVisible = true;
      }
    }
  }

  dispose(): void {
    if (this.outputChannelOutput) {
      this.outputChannelOutput.dispose();
      this.outputChannelOutput = undefined;
    }
  }
}

export function createLogger(serviceName: string) {
  const loggingService = LoggingService.getInstance();
  return {
    debug: (message: string, data?: unknown) => loggingService.debug(serviceName, message, data),
    info: (message: string, data?: unknown) => loggingService.info(serviceName, message, data),
    warn: (message: string, data?: unknown) => loggingService.warn(serviceName, message, data),
    error: (message: string, data?: unknown) => loggingService.error(serviceName, message, data),
  };
}

export type Logger = ReturnType<typeof createLogger>;
