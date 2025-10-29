import { ProviderCapabilities } from "./ProviderCapabilities";

export interface ProviderMetadata {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  homepage?: string;
  capabilities: ProviderCapabilities;
  dependencies: string[];
  minQwikiVersion: string;
  entryPoint: string;
}

export interface ProviderManifest extends ProviderMetadata {
  manifestVersion: string;
  checksum: string;
}
