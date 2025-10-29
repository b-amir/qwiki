import { DocumentationFormat, ValidationSchema } from "./OutputValidationService";

export interface NormalizationRule {
  type: string;
  pattern?: RegExp;
  replacement?: string;
  priority: number;
  transform?: (content: string) => string;
}

export interface NormalizationConfig {
  rules: NormalizationRule[];
  format: DocumentationFormat;
  encoding?: string;
}

export class OutputNormalizationService {
  private rules: NormalizationRule[] = [];

  async normalizeOutput(content: string, config: NormalizationConfig): Promise<string> {
    let result = this.standardizeLineEndings(content);
    const all = [...this.rules, ...config.rules].sort((a, b) => b.priority - a.priority);
    for (const r of all) {
      if (r.transform) {
        result = r.transform(result);
        continue;
      }
      if (r.pattern && r.replacement !== undefined) result = result.replace(r.pattern, r.replacement);
    }
    if (config.format) result = await this.standardizeFormat(result, config.format);
    return result.trim();
  }

  async standardizeFormat(content: string, targetFormat: DocumentationFormat): Promise<string> {
    if (targetFormat === DocumentationFormat.Markdown) return this.normalizeMarkdown(content);
    if (targetFormat === DocumentationFormat.HTML) return this.normalizeHTML(content);
    return this.collapseWhitespace(content);
  }

  async normalizeStructure(content: string, schema: ValidationSchema): Promise<string> {
    if (schema.format === DocumentationFormat.Markdown) return this.normalizeMarkdown(content);
    if (schema.format === DocumentationFormat.HTML) return this.normalizeHTML(content);
    return this.collapseWhitespace(content);
  }

  async normalizeStyle(content: string, styleGuide: Record<string, unknown>): Promise<string> {
    let result = content;
    result = result.replace(/[ \t]+$/gm, "");
    result = result.replace(/\n{3,}/g, "\n\n");
    return result;
  }

  addNormalizationRule(rule: NormalizationRule): void {
    this.rules.push(rule);
    this.rules.sort((a, b) => b.priority - a.priority);
  }

  private standardizeLineEndings(content: string): string {
    return content.replace(/\r\n|\r/g, "\n");
  }

  private collapseWhitespace(content: string): string {
    return content.replace(/\t/g, "  ").replace(/\u00A0/g, " ");
  }

  private normalizeMarkdown(content: string): string {
    let s = this.standardizeLineEndings(content);
    s = s.replace(/^(#{1,6})([^#\s])/gm, (_m, h: string, rest: string) => `${h} ${rest}`);
    const fenceCount = (s.match(/```/g) || []).length;
    if (fenceCount % 2 !== 0) s = s.replace(/```(?![\s\S]*```)/, "```\n\n```");
    s = s.replace(/\n{3,}/g, "\n\n");
    s = s.replace(/\s+$/gm, "");
    return s;
  }

  private normalizeHTML(content: string): string {
    let s = this.standardizeLineEndings(content);
    s = s.replace(/>\s+</g, "><");
    s = s.replace(/\n{3,}/g, "\n\n");
    return s.trim();
  }
}


