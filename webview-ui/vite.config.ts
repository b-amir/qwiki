import { fileURLToPath, URL } from "url";

import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  build: {
    outDir: "build",
    minify: "esbuild",
    rollupOptions: {
      output: {
        entryFileNames: `assets/[name].js`,
        chunkFileNames: `assets/[name].[hash].js`,
        assetFileNames: `assets/[name].[ext]`,
        manualChunks: (id) => {
          if (id.includes("node_modules")) {
            if (id.includes("vue") || id.includes("pinia")) {
              return "vendor";
            }
            if (id.includes("markdown-it")) {
              return "markdown";
            }
            return "vendor-other";
          }
          if (id.includes("/components/pages/HomePage.vue")) {
            return "page-home";
          }
          if (id.includes("/components/pages/SettingsPage.vue")) {
            return "page-settings";
          }
          if (id.includes("/components/pages/ErrorHistoryPage.vue")) {
            return "page-error-history";
          }
          if (id.includes("/components/pages/SavedWikisPage.vue")) {
            return "page-saved-wikis";
          }
          if (id.includes("/components/pages/")) {
            return "pages";
          }
        },
      },
    },
    chunkSizeWarningLimit: 250,
  },
  define: {
    "process.env": {},
  },
});
