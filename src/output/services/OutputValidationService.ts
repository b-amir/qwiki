export enum DocumentationFormat {
  Markdown = "markdown",
  HTML = "html",
  Text = "text",
}

export interface ValidationRule {
  name: string;
  pattern?: RegExp;
  description: string;
  severity: "error" | "warning";
  validate?: (content: string) => ValidationError[];
}

export interface ValidationSchema {
  id: string;
  format: DocumentationFormat;
  rules: ValidationRule[];
  structure?: Record<string, unknown>;
  constraints?: Record<string, unknown>;
}

export interface ValidationError {
  rule: string;
  message: string;
  location?: { index?: number; line?: number; column?: number };
  severity: "error" | "warning";
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

export class OutputValidationService {
  private schemas = new Map<string, ValidationSchema>();

  async validateOutput(content: string, schema: ValidationSchema): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    for (const rule of schema.rules) {
      if (rule.validate) {
        errors.push(...rule.validate(content));
        continue;
      }
      if (rule.pattern && !rule.pattern.test(content)) {
        errors.push({ rule: rule.name, message: rule.description, severity: rule.severity });
      }
    }
    return { valid: errors.every((e) => e.severity !== "error"), errors };
  }

  async createSchema(format: DocumentationFormat): Promise<ValidationSchema> {
    const id = `${format}-${Date.now()}`;
    const rules: ValidationRule[] = this.defaultRulesFor(format);
    const schema: ValidationSchema = { id, format, rules };
    this.schemas.set(id, schema);
    return schema;
  }

  async addValidationRule(schemaId: string, rule: ValidationRule): Promise<void> {
    const schema = this.schemas.get(schemaId);
    if (!schema) throw new Error("schema_not_found");
    schema.rules.push(rule);
  }

  async removeValidationRule(schemaId: string, ruleName: string): Promise<void> {
    const schema = this.schemas.get(schemaId);
    if (!schema) throw new Error("schema_not_found");
    schema.rules = schema.rules.filter((r) => r.name !== ruleName);
  }

  async getValidationErrors(content: string, schema: ValidationSchema): Promise<ValidationError[]> {
    const result = await this.validateOutput(content, schema);
    return result.errors;
  }

  private defaultRulesFor(format: DocumentationFormat): ValidationRule[] {
    if (format === DocumentationFormat.Markdown) {
      return [
        {
          name: "has_heading",
          description: "Missing top-level heading",
          severity: "warning",
          pattern: /^\s*#\s+.+/m,
        },
        {
          name: "close_code_fences",
          description: "Unclosed Markdown code fences",
          severity: "error",
          validate: this.validateMarkdownFences,
        },
        {
          name: "link_format",
          description: "Invalid Markdown link format",
          severity: "warning",
          pattern: /\[[^\]]+\]\([^\)]+\)/,
        },
      ];
    }
    if (format === DocumentationFormat.HTML) {
      return [
        {
          name: "basic_tags",
          description: "HTML appears malformed",
          severity: "warning",
          pattern: /<\w+[^>]*>.*<\/\w+>/s,
        },
      ];
    }
    return [
      {
        name: "non_empty",
        description: "Content should not be empty",
        severity: "error",
        pattern: /\S+/,
      },
    ];
  }

  private validateMarkdownFences(content: string): ValidationError[] {
    const fenceCount = (content.match(/```/g) || []).length;
    if (fenceCount % 2 !== 0)
      return [
        { rule: "close_code_fences", message: "Code fences are not balanced", severity: "error" },
      ];
    return [];
  }
}
