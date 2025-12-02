declare const WikiIdBrand: unique symbol;
declare const ProviderIdBrand: unique symbol;
declare const FileIdBrand: unique symbol;
declare const RequestIdBrand: unique symbol;

export type WikiId = string & { readonly [WikiIdBrand]: typeof WikiIdBrand };
export type ProviderId = string & { readonly [ProviderIdBrand]: typeof ProviderIdBrand };
export type FileId = string & { readonly [FileIdBrand]: typeof FileIdBrand };
export type RequestId = string & { readonly [RequestIdBrand]: typeof RequestIdBrand };

export function createWikiId(id: string): WikiId {
  return id as WikiId;
}

export function createProviderId(id: string): ProviderId {
  return id as ProviderId;
}

export function createFileId(id: string): FileId {
  return id as FileId;
}

export function createRequestId(id: string): RequestId {
  return id as RequestId;
}

export function isWikiId(value: unknown): value is WikiId {
  return typeof value === "string" && value.length > 0;
}

export function isProviderId(value: unknown): value is ProviderId {
  return typeof value === "string" && value.length > 0;
}

export function isFileId(value: unknown): value is FileId {
  return typeof value === "string" && value.length > 0;
}

export function isRequestId(value: unknown): value is RequestId {
  return typeof value === "string" && value.length > 0;
}
