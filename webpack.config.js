"use strict";

const path = require("path");

const extensionConfig = {
  target: "node",
  mode: "none",

  entry: "./src/extension.ts",
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "extension.js",
    libraryTarget: "commonjs2",
  },
  externals: {
    vscode: "commonjs vscode",
  },
  resolve: {
    extensions: [".ts", ".js"],
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@/application": path.resolve(__dirname, "src/application"),
      "@/infrastructure": path.resolve(__dirname, "src/infrastructure"),
      "@/domain": path.resolve(__dirname, "src/domain"),
      "@/events": path.resolve(__dirname, "src/events"),
      "@/llm": path.resolve(__dirname, "src/llm"),
      "@/constants": path.resolve(__dirname, "src/constants"),
      "@/utilities": path.resolve(__dirname, "src/utilities"),
      "@/panels": path.resolve(__dirname, "src/panels"),
      "@/providers": path.resolve(__dirname, "src/providers"),
      "@/views": path.resolve(__dirname, "src/views"),
      "@/presentation": path.resolve(__dirname, "src/presentation"),
      "@/factories": path.resolve(__dirname, "src/factories"),
      "@/container": path.resolve(__dirname, "src/container"),
      "@/errors": path.resolve(__dirname, "src/errors"),
    },
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: [
          {
            loader: "ts-loader",
          },
        ],
      },
    ],
  },
  devtool: "nosources-source-map",
  infrastructureLogging: {
    level: "log",
  },
  ignoreWarnings: [
    // ProviderLoader uses dynamic imports to load providers at runtime.
    // This warning is expected and safe to ignore - providers are loaded
    // dynamically based on metadata, so webpack cannot statically analyze them.
    {
      module: /ProviderLoader\.ts$/,
      message: /Critical dependency: the request of a dependency is an expression/,
    },
  ],
};
module.exports = [extensionConfig];
