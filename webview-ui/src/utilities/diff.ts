export type DiffLine = {
  type: "added" | "removed" | "modified" | "unchanged";
  originalLine?: string;
  updatedLine?: string;
  lineNumber?: number;
};

export function computeLineDiff(original: string, updated: string): DiffLine[] {
  const originalLines = original.split("\n");
  const updatedLines = updated.split("\n");
  const result: DiffLine[] = [];

  const maxLength = Math.max(originalLines.length, updatedLines.length);

  for (let i = 0; i < maxLength; i++) {
    const originalLine = originalLines[i];
    const updatedLine = updatedLines[i];

    if (originalLine === undefined && updatedLine !== undefined) {
      result.push({
        type: "added",
        updatedLine,
        lineNumber: i + 1,
      });
    } else if (originalLine !== undefined && updatedLine === undefined) {
      result.push({
        type: "removed",
        originalLine,
        lineNumber: i + 1,
      });
    } else if (originalLine === updatedLine) {
      result.push({
        type: "unchanged",
        originalLine,
        updatedLine,
        lineNumber: i + 1,
      });
    } else {
      result.push({
        type: "modified",
        originalLine,
        updatedLine,
        lineNumber: i + 1,
      });
    }
  }

  return result;
}
