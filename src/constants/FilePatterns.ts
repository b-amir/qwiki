export const FilePatterns = {
  exclude: "**/{node_modules,dist,out,build,.git,.vscode}/**",
  excludeWithoutVscode: "**/{node_modules,dist,out,build}/**",
  packageJson: "package.json",
  srcAlias: "src/",
  allFiles: "**/*",
} as const;

export const FileLimits = {
  projectFiles: 200,
  relatedFiles: 400,
  maxRelatedResults: 50,
  maxFileSample: 50,
  maxDependencies: 10,
  maxDevDependencies: 5,
} as const;
