#!/usr/bin/env node
"use strict";
var __createBinding =
  (this && this.__createBinding) ||
  (Object.create
    ? function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        var desc = Object.getOwnPropertyDescriptor(m, k);
        if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
          desc = {
            enumerable: true,
            get: function () {
              return m[k];
            },
          };
        }
        Object.defineProperty(o, k2, desc);
      }
    : function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        o[k2] = m[k];
      });
var __setModuleDefault =
  (this && this.__setModuleDefault) ||
  (Object.create
    ? function (o, v) {
        Object.defineProperty(o, "default", { enumerable: true, value: v });
      }
    : function (o, v) {
        o["default"] = v;
      });
var __importStar =
  (this && this.__importStar) ||
  (function () {
    var ownKeys = function (o) {
      ownKeys =
        Object.getOwnPropertyNames ||
        function (o) {
          var ar = [];
          for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
          return ar;
        };
      return ownKeys(o);
    };
    return function (mod) {
      if (mod && mod.__esModule) return mod;
      var result = {};
      if (mod != null)
        for (var k = ownKeys(mod), i = 0; i < k.length; i++)
          if (k[i] !== "default") __createBinding(result, mod, k[i]);
      __setModuleDefault(result, mod);
      return result;
    };
  })();
Object.defineProperty(exports, "__esModule", { value: true });
var fs = __importStar(require("fs"));
var path = __importStar(require("path"));
var PATH_MAPPINGS = [
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
function normalizePath(filePath) {
  return filePath.replace(/\\/g, "/");
}
function resolveRelativePath(fromFile, relativePath) {
  var fromDir = path.dirname(fromFile);
  var resolved = path.resolve(fromDir, relativePath);
  return normalizePath(resolved);
}
function findPathAlias(targetPath) {
  var normalizedTarget = normalizePath(targetPath);
  for (var _i = 0, PATH_MAPPINGS_1 = PATH_MAPPINGS; _i < PATH_MAPPINGS_1.length; _i++) {
    var mapping = PATH_MAPPINGS_1[_i];
    var normalizedPattern = normalizePath(mapping.pattern);
    if (
      normalizedTarget.startsWith(normalizedPattern + "/") ||
      normalizedTarget === normalizedPattern
    ) {
      var remainder = normalizedTarget.slice(normalizedPattern.length);
      if (mapping.alias === "@/constants" && remainder === "") {
        return "@/constants";
      }
      return mapping.alias + remainder;
    }
  }
  return null;
}
function convertRelativeImport(filePath, relativeImport, importStatement) {
  if (relativeImport.startsWith(".")) {
    try {
      var resolvedPath = resolveRelativePath(filePath, relativeImport);
      var projectRoot = path.resolve(process.cwd());
      var relativeToSrc = path.relative(projectRoot, resolvedPath);
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
      var normalizedRelative = normalizePath(relativeToSrc);
      var alias = findPathAlias(normalizedRelative);
      if (alias) {
        var finalAlias = alias;
        if (relativeImport.endsWith(".ts") || relativeImport.endsWith(".tsx")) {
          finalAlias = alias.replace(/\.tsx?$/, "");
        }
        var newImport = importStatement.replace(relativeImport, finalAlias);
        return newImport;
      }
    } catch (error) {
      console.warn(
        '\u26A0\uFE0F  Error processing import "'
          .concat(relativeImport, '" in ')
          .concat(path.relative(process.cwd(), filePath), ": ")
          .concat(error),
      );
    }
  }
  return importStatement;
}
function processFile(filePath, content) {
  var lines = content.split("\n");
  var changed = false;
  var newLines = [];
  var importRegex = /^(\s*)(import\s+(?:type\s+)?.*?\s+from\s+['"])(\.\.?\/[^'"]*)(['"])/;
  for (var _i = 0, lines_1 = lines; _i < lines_1.length; _i++) {
    var line = lines_1[_i];
    var match = line.match(importRegex);
    if (match) {
      var indent = match[1],
        prefix = match[2],
        relativePath = match[3],
        suffix = match[4];
      var newImport = convertRelativeImport(filePath, relativePath, line);
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
    changed: changed,
    content: newLines.join("\n"),
  };
}
function findTypeScriptFiles(dir, fileList) {
  if (fileList === void 0) {
    fileList = [];
  }
  var files = fs.readdirSync(dir);
  for (var _i = 0, files_1 = files; _i < files_1.length; _i++) {
    var file = files_1[_i];
    var filePath = path.join(dir, file);
    var stat = fs.statSync(filePath);
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
  var projectRoot = process.cwd();
  var srcDir = path.join(projectRoot, "src");
  var webviewDir = path.join(projectRoot, "webview-ui", "src");
  console.log("🔍 Finding TypeScript files...");
  var files = [];
  if (fs.existsSync(srcDir)) {
    files.push.apply(files, findTypeScriptFiles(srcDir));
  }
  if (fs.existsSync(webviewDir)) {
    files.push.apply(files, findTypeScriptFiles(webviewDir));
  }
  console.log("\uD83D\uDCC1 Found ".concat(files.length, " TypeScript files"));
  var changedCount = 0;
  var totalImportsFixed = 0;
  for (var _i = 0, files_2 = files; _i < files_2.length; _i++) {
    var file = files_2[_i];
    var originalContent = fs.readFileSync(file, "utf-8");
    var originalImports = (originalContent.match(/from\s+['"]\.\.?\/[^'"]*['"]/g) || []).length;
    if (originalImports > 0) {
      var result = processFile(file, originalContent);
      if (result.changed) {
        fs.writeFileSync(file, result.content, "utf-8");
        changedCount++;
        var relativePath = path.relative(projectRoot, file);
        console.log(
          "\u2705 Fixed ".concat(originalImports, " import(s) in: ").concat(relativePath),
        );
        totalImportsFixed += originalImports;
      }
    }
  }
  console.log("\n📊 Summary:");
  console.log("   Files processed: ".concat(files.length));
  console.log("   Files changed: ".concat(changedCount));
  console.log("   Total imports fixed: ".concat(totalImportsFixed));
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
