export { openrouterPromptTemplate } from "./openrouter-template";
export { zaiPromptTemplate } from "./zai-template";
export { googlePromptTemplate } from "./google-template";
export { coherePromptTemplate } from "./cohere-template";
export { huggingfacePromptTemplate } from "./huggingface-template";
export { defaultPromptTemplate } from "./default-template";

export type PromptTemplate = {
  system: string;
  buildUserPrompt: (params: any, context?: string, examples?: string[]) => string;
};
