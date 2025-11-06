<script setup lang="ts">
interface ReadmeSection {
  name: string;
  content: string;
  priority: number;
  template?: string;
}

interface Props {
  sections: ReadmeSection[];
  enabledSections: Set<string>;
}

interface Emits {
  (e: "update:enabledSections", value: Set<string>): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const toggleSection = (sectionName: string) => {
  const newSet = new Set(props.enabledSections);
  if (newSet.has(sectionName)) {
    newSet.delete(sectionName);
  } else {
    newSet.add(sectionName);
  }
  emit("update:enabledSections", newSet);
};
</script>

<template>
  <div class="space-y-2">
    <div class="text-muted-foreground mb-2 text-sm font-medium">Sections to Include</div>
    <div class="space-y-2">
      <label
        v-for="section in sections"
        :key="section.name"
        class="border-border hover:bg-accent/50 flex cursor-pointer items-center gap-2 rounded-md border p-2"
      >
        <input
          type="checkbox"
          :checked="enabledSections.has(section.name)"
          class="rounded"
          @change="toggleSection(section.name)"
        />
        <div class="flex-1">
          <div class="text-sm font-medium">{{ section.name }}</div>
          <div class="text-muted-foreground mt-1 line-clamp-2 text-xs">
            {{ section.content.substring(0, 100) }}...
          </div>
        </div>
      </label>
    </div>
  </div>
</template>
