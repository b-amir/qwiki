import { posix, win32 } from "path";
import * as os from "os";

export interface PathSanitizationResult {
  sanitized: string;
  isValid: boolean;
  warnings: string[];
}

const INVALID_CHARS_WINDOWS = /[<>:"|?*\x00-\x1f]/g;
const INVALID_CHARS_UNIX = /[\x00-\x1f]/g;
const PATH_TRAVERSAL_PATTERNS = [/^\.\.$/, /^\.\.\//, /\/\.\.\//, /\\\.\.\\/, /^\.\.\\/, /\.\.$/];
const MAX_PATH_LENGTH = 260;
const MAX_PATH_LENGTH_UNIX = 4096;

const isWindows = (): boolean => {
  return os.platform() === "win32";
};

export class PathSanitizer {
  static sanitizePath(input: string, basePath?: string): PathSanitizationResult {
    const warnings: string[] = [];
    let sanitized = input.trim();

    if (!sanitized || sanitized.length === 0) {
      return {
        sanitized: "",
        isValid: false,
        warnings: ["Path cannot be empty"],
      };
    }

    const isWin = isWindows();
    if (sanitized.length > (isWin ? MAX_PATH_LENGTH : MAX_PATH_LENGTH_UNIX)) {
      warnings.push(`Path exceeds maximum length`);
      sanitized = sanitized.substring(0, isWin ? MAX_PATH_LENGTH : MAX_PATH_LENGTH_UNIX);
    }

    if (isWin) {
      const driveLetterMatch = sanitized.match(/^([A-Za-z]:)/);
      if (driveLetterMatch) {
        const driveLetter = driveLetterMatch[1];
        const pathAfterDrive = sanitized.substring(driveLetter.length);
        if (INVALID_CHARS_WINDOWS.test(pathAfterDrive)) {
          warnings.push(`Path contains invalid characters`);
          sanitized = driveLetter + pathAfterDrive.replace(INVALID_CHARS_WINDOWS, "");
        }
      } else {
        if (INVALID_CHARS_WINDOWS.test(sanitized)) {
          warnings.push(`Path contains invalid characters`);
          sanitized = sanitized.replace(INVALID_CHARS_WINDOWS, "");
        }
      }
    } else {
      const invalidCharsPattern = INVALID_CHARS_UNIX;
      if (invalidCharsPattern.test(sanitized)) {
        warnings.push(`Path contains invalid characters`);
        sanitized = sanitized.replace(invalidCharsPattern, "");
      }
    }

    for (const pattern of PATH_TRAVERSAL_PATTERNS) {
      if (pattern.test(sanitized)) {
        warnings.push(`Path contains traversal patterns`);
        return {
          sanitized: input,
          isValid: false,
          warnings,
        };
      }
    }

    sanitized = sanitized.replace(/[\\/]+/g, isWin ? "\\" : "/");
    sanitized = sanitized.replace(/^[\\/]+/, "");
    sanitized = sanitized.replace(/[\\/]+$/, "");

    if (basePath) {
      try {
        const normalized = isWin
          ? win32.resolve(basePath, sanitized)
          : posix.resolve(basePath, sanitized);
        if (!normalized.startsWith(basePath)) {
          warnings.push(`Path resolved outside base directory`);
          return {
            sanitized: input,
            isValid: false,
            warnings,
          };
        }
        sanitized = normalized;
      } catch {
        warnings.push(`Failed to resolve path relative to base`);
        return {
          sanitized: input,
          isValid: false,
          warnings,
        };
      }
    }

    return {
      sanitized,
      isValid: warnings.length === 0,
      warnings,
    };
  }

  static sanitizeFileName(fileName: string): string {
    if (!fileName || fileName.trim().length === 0) {
      return "file";
    }

    let sanitized = fileName.trim();
    const invalidCharsPattern = isWindows() ? INVALID_CHARS_WINDOWS : INVALID_CHARS_UNIX;
    sanitized = sanitized.replace(invalidCharsPattern, "");
    sanitized = sanitized.replace(/[\\/]/g, "-");
    sanitized = sanitized.replace(/^\.+/, "");
    sanitized = sanitized.replace(/\.+$/, "");

    if (sanitized.length === 0) {
      sanitized = "file";
    }

    const maxLength = 255;
    if (sanitized.length > maxLength) {
      const extMatch = sanitized.match(/\.([^.]+)$/);
      const ext = extMatch ? extMatch[1] : "";
      const nameWithoutExt = ext ? sanitized.slice(0, -(ext.length + 1)) : sanitized;
      const maxNameLength = maxLength - (ext ? ext.length + 1 : 0);
      sanitized = nameWithoutExt.substring(0, maxNameLength) + (ext ? `.${ext}` : "");
    }

    return sanitized;
  }

  static validatePath(path: string): boolean {
    if (!path || path.trim().length === 0) {
      return false;
    }

    const invalidCharsPattern = isWindows() ? INVALID_CHARS_WINDOWS : INVALID_CHARS_UNIX;
    if (invalidCharsPattern.test(path)) {
      return false;
    }

    for (const pattern of PATH_TRAVERSAL_PATTERNS) {
      if (pattern.test(path)) {
        return false;
      }
    }

    return true;
  }
}
