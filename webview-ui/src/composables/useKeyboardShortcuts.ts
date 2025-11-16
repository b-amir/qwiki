import { onMounted, onBeforeUnmount, type Ref } from "vue";

export interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
  alt?: boolean;
  handler: (event: KeyboardEvent) => void;
  preventDefault?: boolean;
}

export function useKeyboardShortcuts(
  shortcuts: KeyboardShortcut[],
  enabled?: Ref<boolean>,
) {
  const handleKeyDown = (event: KeyboardEvent) => {
    if (enabled && !enabled.value) {
      return;
    }

    for (const shortcut of shortcuts) {
      const keyMatches = event.key === shortcut.key || event.code === shortcut.key;
      const ctrlMatches = shortcut.ctrl ? event.ctrlKey || event.metaKey : !event.ctrlKey && !event.metaKey;
      const metaMatches = shortcut.meta ? event.metaKey : !event.metaKey;
      const shiftMatches = shortcut.shift === undefined ? true : event.shiftKey === shortcut.shift;
      const altMatches = shortcut.alt === undefined ? true : event.altKey === shortcut.alt;

      if (
        keyMatches &&
        (shortcut.ctrl ? (event.ctrlKey || event.metaKey) : ctrlMatches) &&
        (shortcut.meta ? event.metaKey : metaMatches) &&
        shiftMatches &&
        altMatches
      ) {
        if (shortcut.preventDefault !== false) {
          event.preventDefault();
        }
        shortcut.handler(event);
        break;
      }
    }
  };

  onMounted(() => {
    window.addEventListener("keydown", handleKeyDown);
  });

  onBeforeUnmount(() => {
    window.removeEventListener("keydown", handleKeyDown);
  });

  return {
    handleKeyDown,
  };
}

