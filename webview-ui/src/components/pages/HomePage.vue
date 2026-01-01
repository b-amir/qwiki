<script setup lang="ts">
import { computed } from "vue";
import { useWikiStore } from "@/stores/wiki";
import { useNavigation } from "@/composables/useNavigation";
import Button from "@/components/ui/Button.vue";
import { stepCatalog } from "@/loading/stepCatalog";
import { useEnvironmentStore } from "@/stores/environment";
import StepSpinner from "@/components/StepSpinner.vue";

const wiki = useWikiStore();
const environment = useEnvironmentStore();
const { navigateTo } = useNavigation();

const extensionReady = computed(() => environment.extensionStatus.ready);

const buttonText = computed(() => {
  if (wiki.loading) {
    if (wiki.loadingStep) {
      const step = stepCatalog.wiki.find((s) => s.key === wiki.loadingStep);
      return step?.text || "Loading...";
    }
    return "Starting...";
  }
  return "Generate Wiki";
});
</script>

<template>
  <div class="flex flex-1 flex-col p-3 sm:p-6">
    <div class="flex flex-1 flex-col items-center justify-center space-y-4 sm:space-y-6">
      <div class="flex items-center justify-center">
        <svg
          class="h-16 w-16 min-[240px]:h-20 min-[240px]:w-20 sm:h-[120px] sm:w-[120px]"
          viewBox="0 0 512 512"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M361.933 444.533C332.466 459.029 296.914 467 255.496 467C117.859 467 45 378.972 45 255.997C45 133.972 117.859 45 255.496 45C393.134 45 466 133.981 466 255.997C466 291.437 459.948 323.974 448.039 352.339"
            stroke="currentColor"
            stroke-width="42"
          />
          <path
            d="M326.619 306.646C366.639 336.548 406.659 366.45 446.68 396.351C448.903 398.012 451.127 399.673 453.351 401.334C450.062 417.585 420.383 445.065 407.639 448.877C405.892 446.72 404.144 444.563 402.397 442.407L308.049 325.96C306.302 323.804 304.555 321.648 302.808 319.492C306.065 312.06 311.011 307.114 319.949 301.663C322.172 303.324 324.396 304.985 326.619 306.646Z"
            fill="currentColor"
          />
          <path
            d="M232.684 316.76L242.897 379.486C243.603 383.819 246.295 387.573 250.173 389.632C254.158 391.747 258.917 391.818 262.963 389.824L263.177 389.719C267.44 387.618 270.404 383.562 271.11 378.862L280.192 318.44C281.07 312.592 283.082 306.971 286.112 301.893L286.364 301.471C289.511 296.197 293.747 291.654 298.789 288.146C304.504 284.17 311.094 281.634 318 280.753L380.168 272.823C385.728 272.113 390.42 268.343 392.31 263.066C393.99 258.372 393.212 253.149 390.236 249.149L389.119 247.647C386.119 243.615 381.599 240.986 376.611 240.371L320.063 233.404C311.845 232.391 304.079 229.087 297.651 223.869C293.348 220.377 289.742 216.105 287.021 211.277L286.241 209.893C283.121 204.357 281.033 198.302 280.077 192.02L271.215 133.787C270.449 128.754 267.125 124.48 262.436 122.5L262.227 122.411C258.589 120.874 254.474 120.93 250.88 122.566C246.591 124.517 243.557 128.477 242.791 133.126L233.147 191.627C232.061 198.212 230.609 204.782 227.652 210.766C226.307 213.49 224.674 216.339 222.861 218.583C222.814 218.641 222.768 218.698 222.72 218.755C213.602 229.778 198.228 232.724 184.022 234.411L134.386 240.306C129.001 240.945 124.323 244.309 122.002 249.21C120.091 253.247 119.983 257.905 121.705 262.027L121.935 262.578C124.285 268.204 129.453 272.153 135.498 272.943L195.788 280.818C202.213 281.658 208.364 283.942 213.778 287.5C219.739 291.417 224.671 296.84 228.046 303.123C230.324 307.365 231.911 312.009 232.684 316.76Z"
            fill="url(#qwikiAnimatedGradient)"
          />
        </svg>
      </div>

      <h1 class="px-2 text-center text-base font-semibold min-[240px]:text-lg sm:text-xl">
        One <span class="qwiki-gradient-text">Qwiki</span> and you'll know.
      </h1>

      <div
        class="min-[264px]:bg-muted/20 min-[264px]:border-border/50 w-full max-w-[280px] rounded-lg px-2 py-2 min-[264px]:border sm:max-w-md sm:px-3"
      >
        <div class="flex flex-col items-center space-y-2 opacity-70">
          <div class="flex flex-col items-center gap-1 text-center">
            <p class="text-muted-foreground break-words text-xs">
              <span class="hidden min-[264px]:inline">Select code, then press:</span>
              <kbd
                class="bg-background border-border/80 text-foreground ml-1 inline-flex h-5 shrink-0 items-center justify-center rounded border px-1.5 text-xs font-medium shadow-sm"
                >Ctrl+Shift+Q</kbd
              >
            </p>

            <span class="text-muted-foreground hidden break-words text-xs min-[264px]:inline"
              >or right-click:
              <span
                class="bg-background text-foreground shadow-xs inline-flex shrink-0 items-center justify-center rounded px-1.5 py-0.5 text-[10.8px] font-medium"
                >Qwiki: Generate a Quick Wiki</span
              ></span
            >
          </div>
        </div>
      </div>
    </div>

    <div
      class="mt-auto flex min-h-[68px] flex-col items-center justify-center gap-2 pb-4 pt-4 sm:min-h-[76px] sm:gap-3 sm:pt-6"
    >
      <template v-if="!extensionReady">
        <div class="flex items-center justify-center gap-2">
          <StepSpinner />
          <span class="text-muted-foreground text-xs sm:text-sm">{{
            environment.extensionStatus.message || "Preparing services"
          }}</span>
        </div>
      </template>

      <template v-else>
        <div class="w-full min-w-0 max-w-md">
          <Button
            :disabled="wiki.loading || !extensionReady"
            class="bg-foreground w-full min-w-0 text-sm sm:text-base"
            @click="wiki.generate"
          >
            <svg
              v-if="wiki.loading"
              class="mr-2 h-4 w-4 animate-spin"
              fill="none"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <circle
                class="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                stroke-width="4"
              />
              <path
                class="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            {{ buttonText }}
          </Button>
        </div>

        <div class="flex justify-center">
          <button
            class="text-muted-foreground hover:text-muted-foreground/80 py-2 text-xs sm:text-sm"
            :class="{ 'cursor-not-allowed opacity-60': !extensionReady }"
            :disabled="!extensionReady"
            @click="extensionReady && navigateTo('settings')"
          >
            Change model
          </button>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.qwiki-gradient-text {
  background: linear-gradient(90deg, #8b5cf6, #3b82f6);
  background-size: 200% 200%;
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  animation: gradientShift 3s ease infinite;
}

@keyframes gradientShift {
  0% {
    background-position: 0% 50%;
  }
  50% {
    background-position: 100% 50%;
  }
  100% {
    background-position: 0% 50%;
  }
}
</style>
