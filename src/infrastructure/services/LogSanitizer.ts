import { workspace } from "vscode";
import * as crypto from "crypto";
import { ServiceLimits } from "../../constants";

const DEFAULT_MAX_LENGTH = 50;
const HASH_THRESHOLD = 100;
const HASH_LENGTH = 8;
const PREVIEW_MAX_LENGTH = 30;
const LONG_STRING_THRESHOLD = 200;
const PATTERN_MAX_LENGTH = 100;

export class LogSanitizer {
  private static workspaceRoot: string | undefined;
  private static pathCache = new Map<string, string>();

  static sanitizePath(filePath: string | undefined): string | undefined {
    if (!filePath) return filePath;

    if (this.pathCache.has(filePath)) {
      return this.pathCache.get(filePath);
    }

    try {
      if (!this.workspaceRoot) {
        const folders = workspace.workspaceFolders;
        this.workspaceRoot = folders?.[0]?.uri.fsPath;
      }

      if (this.workspaceRoot && filePath.startsWith(this.workspaceRoot)) {
        const relative = filePath.substring(this.workspaceRoot.length).replace(/^[\\/]/, "");
        this.pathCache.set(filePath, relative);
        return relative;
      }

      const basename = filePath.split(/[\\/]/).pop() || filePath;
      this.pathCache.set(filePath, basename);
      return basename;
    } catch {
      const basename = filePath.split(/[\\/]/).pop() || filePath;
      this.pathCache.set(filePath, basename);
      return basename;
    }
  }

  static sanitizeString(
    value: string | undefined,
    maxLength: number = DEFAULT_MAX_LENGTH,
  ): string | undefined {
    if (!value) return value;
    if (value.length <= maxLength) return value;

    if (value.length > HASH_THRESHOLD) {
      const hash = crypto.createHash("md5").update(value).digest("hex").substring(0, HASH_LENGTH);
      return `[hash:${hash}]`;
    }

    return `${value.substring(0, maxLength)}...`;
  }

  static sanitizePattern(pattern: string | RegExp | undefined): string | undefined {
    if (!pattern) return undefined;
    const patternStr = pattern instanceof RegExp ? pattern.toString() : pattern;
    if (patternStr.length > PATTERN_MAX_LENGTH) {
      return "[pattern:truncated]";
    }
    return patternStr;
  }

  static sanitizeData(data: any): any {
    if (!data || typeof data !== "object") {
      return data;
    }

    if (Array.isArray(data)) {
      return data.map((item) => this.sanitizeData(item));
    }

    const sanitized: any = {};
    for (const [key, value] of Object.entries(data)) {
      if (
        key === "path" ||
        key === "filePath" ||
        key === "targetFilePath" ||
        key === "candidatePath" ||
        key === "file"
      ) {
        sanitized[key] = this.sanitizePath(value as string);
      } else if (key === "pattern" || key === "regex") {
        sanitized[key] = this.sanitizePattern(value as string | RegExp);
      } else if (key === "deduplicationKey" || key === "groupKey" || key.includes("Key")) {
        sanitized[key] = typeof value === "string" ? this.sanitizeString(value) : value;
      } else if (
        key === "preview" &&
        typeof value === "string" &&
        value.length > PREVIEW_MAX_LENGTH
      ) {
        sanitized[key] = this.sanitizeString(value, PREVIEW_MAX_LENGTH);
      } else if (typeof value === "string" && value.length > LONG_STRING_THRESHOLD) {
        sanitized[key] = this.sanitizeString(value);
      } else if (typeof value === "object") {
        sanitized[key] = this.sanitizeData(value);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  static clearCache(): void {
    this.pathCache.clear();
    this.workspaceRoot = undefined;
  }
}
