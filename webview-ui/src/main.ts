import { createApp } from "vue";
import { createPinia } from "pinia";
import App from "./App.vue";
import "./style.css";
import "highlight.js/styles/github-dark.css";

function applyVscodeThemeClass() {
  const body = document.body;
  const isLight =
    body.classList.contains("vscode-light") ||
    body.classList.contains("vscode-high-contrast-light");
  const isDark =
    body.classList.contains("vscode-dark") || body.classList.contains("vscode-high-contrast");
  document.documentElement.classList.toggle("dark", isDark && !isLight);
  (document.documentElement.style as any).colorScheme = isLight ? "light" : "dark";
}

applyVscodeThemeClass();
new MutationObserver(() => applyVscodeThemeClass()).observe(document.body, {
  attributes: true,
  attributeFilter: ["class"],
});

const app = createApp(App);
app.use(createPinia());
app.mount("#app");
