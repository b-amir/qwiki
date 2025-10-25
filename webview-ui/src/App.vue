<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, computed, watch } from "vue";
import Button from "@/components/ui/button.vue";
import Skeleton from "@/components/Skeleton.vue";
import MarkdownRenderer from "@/components/MarkdownRenderer.vue";
import { useWikiStore } from "@/stores/wiki";
import { useSettingsStore } from "@/stores/settings";

const tab = ref<"wiki" | "settings">("wiki");
const wiki = useWikiStore();
const settings = useSettingsStore();

const handleMessage = (event: MessageEvent<{ command?: string; payload?: any }>) => {
  const command = event.data?.command;
  if (command !== "navigate") return;
  const nextTab = event.data?.payload?.tab;
  if (nextTab === "wiki" || nextTab === "settings") {
    tab.value = nextTab;
  }
};

onMounted(() => {
  window.addEventListener("message", handleMessage);
  wiki.init();
});

onBeforeUnmount(() => {
  window.removeEventListener("message", handleMessage);
});

const currentModels = computed(
  () => wiki.providers.find((p) => p.id === wiki.providerId)?.models || [],
);

watch(
  () => wiki.providerId,
  () => {
    if (!currentModels.value.includes(wiki.model)) {
      wiki.model = currentModels.value[0] || "";
    }
  },
  { immediate: true },
);
</script>

<template>
  <main class="bg-background flex h-full w-full flex-col">
    <!-- Top bar -->
    <div v-if="tab === 'settings'" class="bg-background flex items-center justify-between border-b p-3">
      <!-- Back button on settings page -->
      <div class="flex items-center gap-2">
        <a
          class="text-foreground hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring inline-flex h-9 w-9 items-center justify-center rounded-md bg-transparent text-sm font-medium transition-all duration-200 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2"
          title="Back"
          @click="tab = 'wiki'"
        >
          <svg class="h-5 w-5" viewBox="0 0 1024 1024" aria-hidden="true" focusable="false">
            <path d="M224 480h640a32 32 0 1 1 0 64H224a32 32 0 0 1 0-64z" fill="currentColor" />
            <path
              d="m237.248 512 265.408 265.344a32 32 0 0 1-45.312 45.312l-288-288a32 32 0 0 1 0-45.312l288-288a32 32 0 1 1 45.312 45.312L237.248 512z"
              fill="currentColor"
            />
          </svg>
        </a>
        <span class="text-sm font-medium">{{ tab === "wiki" ? "Qwiki" : "Settings" }}</span>
      </div>
      <!-- Gear on wiki page -->
    </div>

    <!-- Content area -->
    <div class="flex-1 overflow-auto p-3">
      <!-- Wiki Page -->
      <div v-if="tab === 'wiki'" class="space-y-3">
        <div class="flex flex-wrap items-center gap-2">
          <select v-model="wiki.providerId" class="bg-background rounded border px-2 py-1 text-sm">
            <option v-for="p in wiki.providers" :key="p.id" :value="p.id">
              {{ p.name }}
              {{ p.hasKey ? "" : "(no key)" }}
            </option>
          </select>
          <select v-model="wiki.model" class="bg-background rounded border px-2 py-1 text-sm">
            <option v-for="m in currentModels" :key="m" :value="m">{{ m }}</option>
          </select>
          <Button size="sm" variant="outline" @click="wiki.refreshSelection">Use Selection</Button>
          <Button size="sm" @click="wiki.generate">Generate Wiki</Button>
        </div>

        <div v-if="wiki.loading">
          <Skeleton />
        </div>
        <div v-else-if="wiki.error" class="text-sm text-red-400">{{ wiki.error }}</div>
        <div v-else-if="wiki.content">
          <MarkdownRenderer :content="wiki.content" />
        </div>

        <div
          v-if="wiki.related.length || wiki.filesSample.length"
          class="border-border grid gap-4 border-t pt-4 md:grid-cols-2"
        >
          <section class="space-y-2">
            <h3 class="text-sm font-semibold tracking-wide">Related files</h3>
            <ul class="divide-border divide-y rounded border">
              <li
                v-for="item in wiki.related"
                :key="item.path + ':' + (item.line || 0)"
                class="hover:bg-accent/50 cursor-pointer px-3 py-2 text-sm"
                @click="wiki.openFile(item.path, item.line)"
              >
                <div class="truncate font-medium">{{ item.path }}</div>
                <div v-if="item.preview" class="text-muted-foreground truncate text-xs">
                  {{ item.preview }}
                </div>
              </li>
            </ul>
          </section>
          <section class="space-y-2">
            <h3 class="text-sm font-semibold tracking-wide">Project</h3>
            <div v-if="wiki.overview" class="text-muted-foreground text-xs">
              {{ wiki.overview }}
            </div>
            <ul class="divide-border max-h-64 divide-y overflow-auto rounded border">
              <li
                v-for="p in wiki.filesSample"
                :key="p"
                class="hover:bg-accent/50 cursor-pointer truncate px-3 py-2 text-sm"
                @click="wiki.openFile(p)"
              >
                {{ p }}
              </li>
            </ul>
          </section>
        </div>
        <div v-else class="text-muted-foreground text-sm">
          Select code in the editor, then click Generate Wiki.
        </div>
      </div>

      <!-- Settings Page -->
      <div v-else class="space-y-4">
        <section class="space-y-2">
          <h3 class="text-sm font-medium">Gemini</h3>
          <input
            v-model="settings.geminiKeyInput"
            type="password"
            placeholder="API Key"
            class="bg-background w-full rounded border px-2 py-1 text-sm"
          />
          <div class="flex gap-2">
            <Button size="sm" @click="settings.saveGemini">Save</Button>
          </div>
        </section>
        <section class="space-y-2">
          <h3 class="text-sm font-medium">Z.ai</h3>
          <input
            v-model="settings.zaiKeyInput"
            type="password"
            placeholder="API Key"
            class="bg-background w-full rounded border px-2 py-1 text-sm"
          />
          <div class="flex gap-2">
            <Button size="sm" @click="settings.saveZai">Save</Button>
          </div>
          <p class="text-muted-foreground text-xs">
            Optional: configure base URL in VS Code settings at qwiki.zaiBaseUrl
          </p>
        </section>
        <p class="text-muted-foreground text-xs">
          Keys are stored securely in VS Code Secret Storage.
        </p>
      </div>
    </div>
  </main>
</template>

<style>
/* Minimal by design; shadcn + Tailwind handle styling. */
</style>
