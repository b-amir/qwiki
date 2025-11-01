<template>
  <svg class="check-icon" viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M20 6L9 17l-5-5"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </svg>
</template>

<style scoped>
.check-icon {
  width: clamp(16px, 4vw, 20px);
  height: clamp(16px, 4vw, 20px);
  flex-shrink: 0;
  color: var(--muted-foreground, var(--vscode-descriptionForeground));
}
</style>
