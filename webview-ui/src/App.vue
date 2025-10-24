<script setup lang="ts">
import { onMounted, ref, computed, watch } from "vue";
import { provideVSCodeDesignSystem, vsCodeButton } from "@vscode/webview-ui-toolkit";
import Button from "@/components/ui/button.vue";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import Skeleton from "@/components/Skeleton.vue";
import MarkdownRenderer from "@/components/MarkdownRenderer.vue";
import { useWikiStore } from "@/stores/wiki";
import { useSettingsStore } from "@/stores/settings";

provideVSCodeDesignSystem().register(vsCodeButton());

const tab = ref<"wiki" | "settings">("wiki");
const wiki = useWikiStore();
const settings = useSettingsStore();

onMounted(() => {
  wiki.init();
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
  <main class="flex h-full w-full flex-col gap-3 p-3">
    <div class="flex items-center gap-2">
      <Button :variant="tab === 'wiki' ? 'default' : 'outline'" @click="tab = 'wiki'">Wiki</Button>
      <Button :variant="tab === 'settings' ? 'default' : 'outline'" @click="tab = 'settings'"
        >Settings</Button
      >
    </div>

    <Card v-if="tab === 'wiki'" class="w-full">
      <CardHeader>
        <CardTitle>Qwiki</CardTitle>
        <CardDescription class="space-y-1">
          <div class="text-muted-foreground truncate text-xs">{{ wiki.filePath }}</div>
          <div class="text-muted-foreground text-xs">{{ wiki.languageId || "plain" }}</div>
        </CardDescription>
      </CardHeader>
      <CardContent class="space-y-3">
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
          class="grid gap-4 md:grid-cols-2"
        >
          <section class="space-y-2">
            <h3 class="text-sm font-medium">Related files</h3>
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
            <h3 class="text-sm font-medium">Project</h3>
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
      </CardContent>
    </Card>

    <Card v-else class="w-full">
      <CardHeader>
        <CardTitle>Settings</CardTitle>
        <CardDescription>Bring your API keys</CardDescription>
      </CardHeader>
      <CardContent class="space-y-4">
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
      </CardContent>
      <CardFooter>
        <span class="text-muted-foreground text-xs"
          >Keys are stored securely in VS Code Secret Storage.</span
        >
      </CardFooter>
    </Card>
  </main>
</template>

<style>
/* Minimal by design; shadcn + Tailwind handle styling. */
</style>
