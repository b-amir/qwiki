import type { Webview } from "vscode";
import { OutboundEvents } from "../../constants/Events";
import type { LoadingStep } from "../../constants/Events";
import { ErrorCodes } from "../../constants/ErrorCodes";

export class MessageBus {
  constructor(private webview: Webview) {}

  postMessage(command: string, payload?: any): void {
    this.webview.postMessage({ command, payload });
  }

  postError(message: string, code: string = ErrorCodes.unknown): void {
    this.postMessage(OutboundEvents.error, { code, message });
  }

  postSuccess(command: string, payload?: any): void {
    this.postMessage(command, payload);
  }

  postLoadingStep(step: LoadingStep): void {
    this.postMessage(OutboundEvents.loadingStep, { step });
  }
}
