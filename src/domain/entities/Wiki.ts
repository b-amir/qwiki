export interface Wiki {
  id: string;
  content: string;
  snippet: string;
  languageId?: string;
  filePath?: string;
  createdAt: Date;
  providerId: string;
  model?: string;
}

export interface WikiGenerationRequest {
  snippet: string;
  languageId?: string;
  filePath?: string;
  providerId: string;
  model?: string;
}

export interface WikiGenerationResult {
  content: string;
  success: boolean;
  error?: string;
}
