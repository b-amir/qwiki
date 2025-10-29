type MessageListener = (event: MessageEvent) => void

interface MessageEvent<T = any> {
  data: T
}

interface VSCodeApiLike {
  postMessage(message: unknown): void
}

interface GlobalWindow {
  addEventListener(type: string, listener: MessageListener): void
  removeEventListener?(type: string, listener: MessageListener): void
  vscode?: VSCodeApiLike
  [key: string]: unknown
}

declare const window: GlobalWindow

interface DocumentLike {
  getElementById(id: string): HTMLElement | null
  addEventListener(type: string, listener: () => void): void
}

declare const document: DocumentLike

interface HTMLElement {
  innerHTML: string
}

interface HTMLSelectElement extends HTMLElement {
  selectedOptions: ArrayLike<HTMLOptionElement>
}

interface HTMLOptionElement {
  value: string
}

declare const confirm: (message: string) => boolean
