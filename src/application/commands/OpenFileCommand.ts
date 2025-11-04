import type { Command } from "./Command";
import { tryOpenFile } from "../../panels/fileOps";
import { PathSanitizer } from "../../utilities/pathSanitizer";

interface OpenFilePayload {
  path: string;
  line?: number;
}

export class OpenFileCommand implements Command<OpenFilePayload> {
  async execute(payload: OpenFilePayload): Promise<void> {
    const sanitizationResult = PathSanitizer.sanitizePath(payload.path);
    if (!sanitizationResult.isValid) {
      throw new Error(`Invalid file path: ${sanitizationResult.warnings.join(", ")}`);
    }
    await tryOpenFile(sanitizationResult.sanitized, payload.line);
  }
}
