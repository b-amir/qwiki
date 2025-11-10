export const PathPatterns = {
  baseNameRegex: /[^\\\/]+$/,
  identifierRegex: /[A-Za-z_][A-Za-z0-9_\-]*/g,
  absolutePathRegex: /^\w:\\|^\\\\|^\//,
  aliasRegex: /^@\//,
  pathSeparatorRegex: /[\\/]/,
  currentDirRegex: /^\.(?:[\\\/]|$)/,
  wordBoundaryRegex: /\\b/,
  specialCharsRegex: /[.*+?^${}()|[\\]\\]/g,
  escapeCharRegex: /\\+$/,
} as const;

export const PathStrings = {
  aliasPrefix: "@/",
  srcPrefix: "src/",
  dot: ".",
  slash: "/",
  backslash: "\\",
  doubleBackslash: "\\\\",
  empty: "",
  space: " ",
  semicolon: ";",
  comma: ", ",
  colon: ": ",
  dotAtEnd: ".",
} as const;

export const VSCodeCommands = {
  open: "vscode.open",
  diff: "vscode.diff",
} as const;
