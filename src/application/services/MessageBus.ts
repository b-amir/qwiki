import type { Webview } from "vscode";
import { OutboundEvents } from "../../constants/Events";
import type { LoadingStep } from "../../constants/Events";
import { ErrorCodes } from "../../constants/ErrorCodes";
import { WebviewOptimizer } from "../../infrastructure/services/WebviewOptimizer";
import { DebouncingService } from "../../infrastructure/services/DebouncingService";

export class MessageBus {
  private optimizer: WebviewOptimizer;
  private debouncingService: DebouncingService;
  private debouncedPostMessage: any;

  constructor(webview: Webview) {
    this.optimizer = new WebviewOptimizer(webview);
    this.debouncingService = new DebouncingService();
    this.debouncedPostMessage = this.debouncingService.debounce(
      (command: string, payload?: any) => {
        this.optimizer.postMessage(command, payload);
      },
      50,
      { leading: false, trailing: true },
    );
  }

  postMessage(command: string, payload?: any): void {
    this.debouncedPostMessage(command, payload);
  }

  postImmediate(command: string, payload?: any): void {
    this.optimizer.postImmediate(command, payload);
  }

  postError(message: string, code: string = ErrorCodes.unknown, suggestion?: string): void {
    this.postImmediate(OutboundEvents.error, { code, message, suggestion });
  }

  postSuccess(command: string, payload?: any): void {
    this.postMessage(command, payload);
  }

  postLoadingStep(step: LoadingStep): void {
    this.postMessage(OutboundEvents.loadingStep, { step });
  }

  dispose(): void {
    this.optimizer.dispose();
  }
}
