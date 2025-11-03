<script setup lang="ts">
import { computed } from "vue";
import MarkdownRenderer from "@/components/MarkdownRenderer.vue";
import Modal from "@/components/ui/Modal.vue";
import ModalHeader from "@/components/ui/ModalHeader.vue";
import ModalContent from "@/components/ui/ModalContent.vue";

interface SavedWiki {
  id: string;
  title: string;
  content: string;
  filePath: string;
  createdAt: Date;
  tags: string[];
}

interface Props {
  wiki: SavedWiki | null;
}

interface Emits {
  (e: "close"): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const wikiContentWithoutTitle = computed(() => {
  if (!props.wiki?.content) return "";
  const content =
    typeof props.wiki.content === "string" ? props.wiki.content : String(props.wiki.content);
  return content.replace(/^#\s+.+$/m, "");
});

const isOpen = computed({
  get: () => !!props.wiki,
  set: (value) => {
    if (!value) {
      emit("close");
    }
  },
});

const handleClose = () => {
  isOpen.value = false;
};
</script>

<template>
  <Modal v-model="isOpen" max-width="max-w-4xl">
    <template #default="{ close }">
      <ModalHeader @close="handleClose">
        <div>
          <h2 class="text-lg font-semibold">{{ wiki?.title }}</h2>
        </div>
      </ModalHeader>
      <ModalContent>
        <MarkdownRenderer :content="wikiContentWithoutTitle" />
      </ModalContent>
    </template>
  </Modal>
</template>
