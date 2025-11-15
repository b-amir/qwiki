export type DiffLine = {
  type: "added" | "removed" | "modified" | "unchanged";
  originalLine?: string;
  updatedLine?: string;
  originalLineNumber?: number;
  updatedLineNumber?: number;
};

type RawDiffOp =
  | {
      type: "added";
      updatedLine: string;
      updatedLineNumber: number;
    }
  | {
      type: "removed";
      originalLine: string;
      originalLineNumber: number;
    }
  | {
      type: "unchanged";
      originalLine: string;
      updatedLine: string;
      originalLineNumber: number;
      updatedLineNumber: number;
    };

export function computeLineDiff(original: string, updated: string): DiffLine[] {
  const originalLines = original.split("\n");
  const updatedLines = updated.split("\n");
  const originalCount = originalLines.length;
  const updatedCount = updatedLines.length;

  const lcsMatrix = Array.from({ length: originalCount + 1 }, () =>
    new Array<number>(updatedCount + 1).fill(0),
  );

  for (let i = originalCount - 1; i >= 0; i--) {
    for (let j = updatedCount - 1; j >= 0; j--) {
      if (originalLines[i] === updatedLines[j]) {
        lcsMatrix[i][j] = lcsMatrix[i + 1][j + 1] + 1;
      } else {
        lcsMatrix[i][j] = Math.max(lcsMatrix[i + 1][j], lcsMatrix[i][j + 1]);
      }
    }
  }

  const raw: RawDiffOp[] = [];
  let i = 0;
  let j = 0;
  let originalLineNumber = 1;
  let updatedLineNumber = 1;

  while (i < originalCount || j < updatedCount) {
    if (i < originalCount && j < updatedCount && originalLines[i] === updatedLines[j]) {
      raw.push({
        type: "unchanged",
        originalLine: originalLines[i],
        updatedLine: updatedLines[j],
        originalLineNumber,
        updatedLineNumber,
      });
      i += 1;
      j += 1;
      originalLineNumber += 1;
      updatedLineNumber += 1;
      continue;
    }

    const nextOriginalScore = i + 1 <= originalCount ? lcsMatrix[i + 1][j] : -1;
    const nextUpdatedScore = j + 1 <= updatedCount ? lcsMatrix[i][j + 1] : -1;

    if (j < updatedCount && (i === originalCount || nextUpdatedScore >= nextOriginalScore)) {
      raw.push({
        type: "added",
        updatedLine: updatedLines[j],
        updatedLineNumber,
      });
      j += 1;
      updatedLineNumber += 1;
    } else if (i < originalCount) {
      raw.push({
        type: "removed",
        originalLine: originalLines[i],
        originalLineNumber,
      });
      i += 1;
      originalLineNumber += 1;
    }
  }

  return normalizeRawDiff(raw);
}

function normalizeRawDiff(raw: RawDiffOp[]): DiffLine[] {
  const result: DiffLine[] = [];
  let index = 0;

  while (index < raw.length) {
    const current = raw[index];

    if (current.type === "removed") {
      const removedChunk: (typeof current)[] = [];
      while (index < raw.length && raw[index].type === "removed") {
        removedChunk.push(raw[index] as typeof current);
        index += 1;
      }

      const addedChunk: Extract<RawDiffOp, { type: "added" }>[] = [];
      let addedIndex = index;
      while (addedIndex < raw.length && raw[addedIndex].type === "added") {
        addedChunk.push(raw[addedIndex] as Extract<RawDiffOp, { type: "added" }>);
        addedIndex += 1;
      }

      const pairCount = Math.min(removedChunk.length, addedChunk.length);

      for (let k = 0; k < pairCount; k++) {
        const removedLine = removedChunk[k];
        const addedLine = addedChunk[k];
        result.push({
          type: "modified",
          originalLine: removedLine.originalLine,
          updatedLine: addedLine.updatedLine,
          originalLineNumber: removedLine.originalLineNumber,
          updatedLineNumber: addedLine.updatedLineNumber,
        });
      }

      if (removedChunk.length > pairCount) {
        for (let k = pairCount; k < removedChunk.length; k++) {
          const removedLine = removedChunk[k];
          result.push({
            type: "removed",
            originalLine: removedLine.originalLine,
            originalLineNumber: removedLine.originalLineNumber,
          });
        }
      }

      if (addedChunk.length > pairCount) {
        for (let k = pairCount; k < addedChunk.length; k++) {
          const addedLine = addedChunk[k];
          result.push({
            type: "added",
            updatedLine: addedLine.updatedLine,
            updatedLineNumber: addedLine.updatedLineNumber,
          });
        }
      }

      index = addedIndex;
      continue;
    }

    if (current.type === "added") {
      result.push({
        type: "added",
        updatedLine: current.updatedLine,
        updatedLineNumber: current.updatedLineNumber,
      });
      index += 1;
      continue;
    }

    result.push({
      type: "unchanged",
      originalLine: current.originalLine,
      updatedLine: current.updatedLine,
      originalLineNumber: current.originalLineNumber,
      updatedLineNumber: current.updatedLineNumber,
    });
    index += 1;
  }

  return result;
}
