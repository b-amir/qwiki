export interface Selection {
  text: string;
  languageId?: string;
  filePath?: string;
}

export interface ProjectContext {
  rootName: string;
  overview: string;
  filesSample: string[];
  related: Array<{
    path: string;
    preview?: string;
    line?: number;
    reason?: string;
  }>;
}
