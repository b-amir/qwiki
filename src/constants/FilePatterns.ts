export const FilePatterns = {
  exclude: "**/{node_modules,dist,out,build,.git,.vscode,_refs,tmp,temp}/**",
  excludeWithoutVscode: "**/{node_modules,dist,out,build,_refs,tmp,temp}/**",
  excludeBinary: "**/*.{png,jpg,jpeg,gif,ico,svg,pdf,zip,tar,gz,exe,dll,so,dylib}",
  excludeLarge: "**/*.min.{js,css}",
  excludeBackups: "**/*.{backup,bak,old}",
  sourceFiles: "**/*.{ts,tsx,js,jsx,py,java,go,rs,php,rb,cs,swift,kt}",
  configFiles: "**/*.{json,yml,yaml,toml,xml,ini,conf}",
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
