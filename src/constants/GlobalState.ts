import { StatusBarItem } from "vscode";

export const HAS_ACTIVE_GENERATION_CONTEXT = "qwiki.hasActiveGeneration";

let statusBarItem: StatusBarItem | null = null;

export function setStatusBarItem(item: StatusBarItem) {
  statusBarItem = item;
}

export function getStatusBarItem(): StatusBarItem | null {
  return statusBarItem;
}
