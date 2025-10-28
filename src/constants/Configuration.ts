export const ConfigurationKeys = {
  zaiBaseUrl: "zaiBaseUrl",
  googleAIEndpoint: "googleAIEndpoint",
} as const;

export const ConfigurationDefaults = {
  [ConfigurationKeys.zaiBaseUrl]: "",
  [ConfigurationKeys.googleAIEndpoint]: "openai-compatible",
} as const;
