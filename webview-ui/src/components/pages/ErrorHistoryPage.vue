<script setup lang="ts">
import { onMounted } from "vue";
import ErrorHistory from "@/components/features/ErrorHistory.vue";
import { useNavigationStatusStore } from "@/stores/navigationStatus";

const navigationStatus = useNavigationStatusStore();

onMounted(() => {
  navigationStatus.finish("errorHistory");
});
</script>

<template>
  <div class="flex h-full flex-col">
    <ErrorHistory />
  </div>
</template>
