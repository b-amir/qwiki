<script setup lang="ts">
import { provideVSCodeDesignSystem, vsCodeButton } from "@vscode/webview-ui-toolkit";
import { useCounterStore } from './stores/counter'
import Button from '@/components/ui/button.vue'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'

// Register VS Code web components (optional; keeps toolkit available if needed)
provideVSCodeDesignSystem().register(vsCodeButton());

const counter = useCounterStore()
</script>

<template>
  <main class="h-full w-full flex items-center justify-center p-6">
    <Card class="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Counter</CardTitle>
        <CardDescription>A minimal Vue + Pinia example</CardDescription>
      </CardHeader>
      <CardContent>
        <div class="flex items-center justify-center">
          <span class="min-w-[4rem] text-center text-3xl font-mono">{{ counter.count }}</span>
        </div>
      </CardContent>
      <CardFooter class="justify-end gap-2">
        <Button variant="outline" @click="counter.decrement" aria-label="decrement">−</Button>
        <Button @click="counter.increment" aria-label="increment">+</Button>
        <Button variant="ghost" @click="counter.reset">Reset</Button>
      </CardFooter>
    </Card>
  </main>
</template>

<style>
/* Minimal by design; shadcn + Tailwind handle styling. */
</style>
