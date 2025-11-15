#!/usr/bin/env node

import * as fs from "fs";
import * as path from "path";

interface PathMapping {
  alias: string;
  pattern: string;
}

const PATH_MAPPINGS: PathMapping[] = [
  { alias: "@/constants", pattern: "src/constants" },
  { alias: "@/application", pattern: "src/application" },
  { alias: "@/infrastructure", pattern: "src/infrastructure" },
  { alias: "@/domain", pattern: "src/domain" },
  { alias: "@/events", pattern: "src/events" },
  { alias: "@/llm", pattern: "src/llm" },
  { alias: "@/utilities", pattern: "src/utilities" },
  { alias: "@/panels", pattern: "src/panels" },
  { alias: "@/providers", pattern: "src/providers" },
  { alias: "@/views", pattern: "src/views" },
  { alias: "@/presentation", pattern: "src/presentation" },
  { alias: "@/factories", pattern: "src/factories" },
  { alias: "@/container", pattern: "src/container" },
  { alias: "@/errors", pattern: "src/errors" },
  { alias: "@/", pattern: "src" },
];

function normalizePath(filePath: string): string {
  return filePath.replace(/\\/g, "/");
}

function resolveRelativePath(fromFile: string, relativePath: string): string {
  const fromDir = path.dirname(fromFile);
  const resolved = path.resolve(fromDir, relativePath);
  return normalizePath(resolved);
}

function findPathAlias(targetPath: string): string | null {
  const normalizedTarget = normalizePath(targetPath);

  for (const mapping of PATH_MAPPINGS) {
    const normalizedPattern = normalizePath(mapping.pattern);
    if (
      normalizedTarget.startsWith(normalizedPattern + "/") ||
      normalizedTarget === normalizedPattern
    ) {
      const remainder = normalizedTarget.slice(normalizedPattern.length);
      if (mapping.alias === "@/constants" && remainder === "") {
        return "@/constants";
      }
      return mapping.alias + remainder;
    }
  }

  return null;
}

function convertRelativeImport(
  filePath: string,
  relativeImport: string,
  importStatement: string,
): string {
  if (relativeImport.startsWith(".")) {
    try {
      const resolvedPath = resolveRelativePath(filePath, relativeImport);
      const projectRoot = path.resolve(process.cwd());
      let relativeToSrc = path.relative(projectRoot, resolvedPath);

      if (relativeToSrc.startsWith("..")) {
        return importStatement;
      }

      if (!relativeToSrc.startsWith("src")) {
        relativeToSrc = normalizePath(relativeToSrc);
        if (relativeToSrc.includes("src/")) {
          relativeToSrc = "src/" + relativeToSrc.split("src/")[1];
        } else {
          return importStatement;
        }
      }

      const normalizedRelative = normalizePath(relativeToSrc);
      const alias = findPathAlias(normalizedRelative);
      if (alias) {
        let finalAlias = alias;
        if (relativeImport.endsWith(".ts") || relativeImport.endsWith(".tsx")) {
          finalAlias = alias.replace(/\.tsx?$/, "");
        }
        const newImport = importStatement.replace(relativeImport, finalAlias);
        return newImport;
      }
    } catch (error) {
      console.warn(
        `⚠️  Error processing import "${relativeImport}" in ${path.relative(process.cwd(), filePath)}: ${error}`,
      );
    }
  }

  return importStatement;
}

function processFile(filePath: string, content: string): { changed: boolean; content: string } {
  const lines = content.split("\n");
  let changed = false;
  const newLines: string[] = [];

  const importRegex = /^(\s*)(import\s+(?:type\s+)?.*?\s+from\s+['"])(\.\.?\/[^'"]*)(['"])/;

  for (const line of lines) {
    const match = line.match(importRegex);
    if (match) {
      const [, indent, prefix, relativePath, suffix] = match;
      const newImport = convertRelativeImport(filePath, relativePath, line);
      if (newImport !== line) {
        newLines.push(newImport);
        changed = true;
      } else {
        newLines.push(line);
      }
    } else {
      newLines.push(line);
    }
  }

  return {
    changed,
    content: newLines.join("\n"),
  };
}

function findTypeScriptFiles(dir: string, fileList: string[] = []): string[] {
  const files = fs.readdirSync(dir);

  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      if (!["node_modules", ".vscode-test", "out", "dist", ".git"].includes(file)) {
        findTypeScriptFiles(filePath, fileList);
      }
    } else if (file.endsWith(".ts") && !file.endsWith(".d.ts")) {
      fileList.push(filePath);
    }
  }

  return fileList;
}

function main() {
  const projectRoot = process.cwd();
  const srcDir = path.join(projectRoot, "src");
  const webviewDir = path.join(projectRoot, "webview-ui", "src");

  console.log("🔍 Finding TypeScript files...");
  const files: string[] = [];

  if (fs.existsSync(srcDir)) {
    files.push(...findTypeScriptFiles(srcDir));
  }

  if (fs.existsSync(webviewDir)) {
    files.push(...findTypeScriptFiles(webviewDir));
  }

  console.log(`📁 Found ${files.length} TypeScript files`);

  let changedCount = 0;
  let totalImportsFixed = 0;

  for (const file of files) {
    const originalContent = fs.readFileSync(file, "utf-8");
    const originalImports = (originalContent.match(/from\s+['"]\.\.?\/[^'"]*['"]/g) || []).length;

    if (originalImports > 0) {
      const result = processFile(file, originalContent);
      if (result.changed) {
        fs.writeFileSync(file, result.content, "utf-8");
        changedCount++;
        const relativePath = path.relative(projectRoot, file);
        console.log(`✅ Fixed ${originalImports} import(s) in: ${relativePath}`);
        totalImportsFixed += originalImports;
      }
    }
  }

  console.log("\n📊 Summary:");
  console.log(`   Files processed: ${files.length}`);
  console.log(`   Files changed: ${changedCount}`);
  console.log(`   Total imports fixed: ${totalImportsFixed}`);

  if (changedCount > 0) {
    console.log("\n✨ Done! All relative imports have been converted to path aliases.");
    console.log("⚠️  Please review the changes and test your code.");
  } else {
    console.log("\n✨ No changes needed! All imports are already using path aliases.");
  }
}

if (require.main === module) {
  main();
}
