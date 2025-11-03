import { defineAsyncComponent } from "vue";

export const HomePage = defineAsyncComponent({
  loader: () => import("./HomePage.vue"),
  loadingComponent: undefined,
  errorComponent: undefined,
  delay: 0,
  timeout: 30000,
});

export const SettingsPage = defineAsyncComponent({
  loader: () => import("./SettingsPage.vue"),
  loadingComponent: undefined,
  errorComponent: undefined,
  delay: 0,
  timeout: 30000,
});

export const ErrorHistoryPage = defineAsyncComponent({
  loader: () => import("./ErrorHistoryPage.vue"),
  loadingComponent: undefined,
  errorComponent: undefined,
  delay: 0,
  timeout: 30000,
});

export const SavedWikisPage = defineAsyncComponent({
  loader: () => import("./SavedWikisPage.vue"),
  loadingComponent: undefined,
  errorComponent: undefined,
  delay: 0,
  timeout: 30000,
});
