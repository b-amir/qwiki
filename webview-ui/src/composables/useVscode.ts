import { vscode } from "@/utilities/vscode";

export function useVscode() {
  return {
    postMessage: vscode.postMessage.bind(vscode),
  };
}
