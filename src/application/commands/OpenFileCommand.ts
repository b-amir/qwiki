import type { Command } from "./Command";
import { tryOpenFile } from "../../panels/fileOps";

interface OpenFilePayload {
  path: string;
  line?: number;
}

export class OpenFileCommand implements Command<OpenFilePayload> {
  async execute(payload: OpenFilePayload): Promise<void> {
    await tryOpenFile(payload.path, payload.line);
  }
}
