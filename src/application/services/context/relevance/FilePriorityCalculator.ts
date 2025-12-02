import type { Uri } from "vscode";

export class FilePriorityCalculator {
  static prioritizeFiles(files: Uri[], targetFilePath: string): Uri[] {
    const targetDir = targetFilePath.substring(
      0,
      targetFilePath.lastIndexOf("/") || targetFilePath.lastIndexOf("\\"),
    );
    const targetFileName = targetFilePath.substring(
      targetFilePath.lastIndexOf("/") + 1 || targetFilePath.lastIndexOf("\\") + 1,
    );

    return files.sort((a, b) => {
      const pathA = a.fsPath;
      const pathB = b.fsPath;

      const priorityA = FilePriorityCalculator.getFilePriority(pathA, targetDir, targetFileName);
      const priorityB = FilePriorityCalculator.getFilePriority(pathB, targetDir, targetFileName);

      return priorityB - priorityA;
    });
  }

  static getFilePriority(filePath: string, targetDir: string, targetFileName: string): number {
    const fileDir = filePath.substring(0, filePath.lastIndexOf("/") || filePath.lastIndexOf("\\"));
    const fileName = filePath.substring(
      filePath.lastIndexOf("/") + 1 || filePath.lastIndexOf("\\") + 1,
    );

    if (fileDir === targetDir) {
      return 100;
    }

    if (fileName === targetFileName) {
      return 80;
    }

    if (filePath.includes("node_modules") || filePath.includes(".git")) {
      return 0;
    }

    if (filePath.match(/package\.json|tsconfig|webpack|vite|rollup/i)) {
      return 60;
    }

    if (filePath.match(/\.(ts|tsx|js|jsx)$/)) {
      return 50;
    }

    return 30;
  }
}
