import {
  QAWorkflow,
  QAStep,
  QACheck,
  QAApproval,
  QualityStandard,
  QACheckResult,
  ValidationResult,
  ValidationRule,
  ValidationError,
  ValidationWarning,
  QualityIssue,
} from "../types/QualityTypes";
import {
  StepType,
  CheckType,
  ApprovalStatus,
  StandardCategory,
  IssueSeverity,
  RecommendationType,
  Priority,
  Impact,
  Effort,
} from "../types/QualityTypes";

export class QualityAssuranceService {
  private workflows: Map<string, QAWorkflow> = new Map();
  private contentApprovals: Map<string, QAApproval[]> = new Map();

  async runQAChecks(content: string, workflow: QAWorkflow): Promise<QACheckResult> {
    const issues: QualityIssue[] = [];
    const recommendations = [];
    let totalScore = 0;
    let checksPassed = 0;
    const totalChecks = workflow.checks.filter((check) => check.enabled).length;

    for (const check of workflow.checks) {
      if (!check.enabled) continue;

      const result = await this.executeCheck(content, check);
      totalScore += result.score;

      if (result.passed) {
        checksPassed++;
      } else {
        issues.push(...this.convertValidationErrorsToQualityIssues(result.errors));
        recommendations.push(...result.recommendations);
      }
    }

    const overallScore = totalChecks > 0 ? totalScore / totalChecks : 0;
    const passed = checksPassed === totalChecks;

    return {
      passed,
      issues,
      recommendations,
      score: overallScore,
      completedAt: new Date(),
      completedBy: "system",
    };
  }

  async createQAWorkflow(standards: QualityStandard[]): Promise<QAWorkflow> {
    const workflowId = this.generateId();
    const steps = this.createStepsFromStandards(standards);
    const checks = this.createChecksFromStandards(standards);
    const approvals = this.createDefaultApprovals();

    const workflow: QAWorkflow = {
      id: workflowId,
      name: `Quality Assurance Workflow - ${new Date().toISOString()}`,
      steps,
      checks,
      approvals,
      standards,
      enabled: true,
    };

    this.workflows.set(workflowId, workflow);
    return workflow;
  }

  async validateAgainstStandards(
    content: string,
    standards: QualityStandard[],
  ): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    let totalScore = 0;

    for (const standard of standards) {
      if (!standard.enabled) continue;

      const standardResult = await this.validateStandard(content, standard);
      totalScore += standardResult.score;

      errors.push(...standardResult.errors);
      warnings.push(...standardResult.warnings);
    }

    const overallScore =
      standards.length > 0 ? totalScore / standards.filter((s) => s.enabled).length : 0;

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      score: overallScore,
    };
  }

  async approveContent(contentId: string, approver: string): Promise<void> {
    const approvals = this.contentApprovals.get(contentId) || [];

    const existingApproval = approvals.find((a) => a.approver === approver);
    if (existingApproval) {
      existingApproval.status = ApprovalStatus.APPROVED;
      existingApproval.timestamp = new Date();
    } else {
      const newApproval: QAApproval = {
        id: this.generateId(),
        approver,
        role: "reviewer",
        required: false,
        status: ApprovalStatus.APPROVED,
        timestamp: new Date(),
      };
      approvals.push(newApproval);
    }

    this.contentApprovals.set(contentId, approvals);
  }

  async rejectContent(contentId: string, reason: string): Promise<void> {
    const approvals = this.contentApprovals.get(contentId) || [];

    for (const approval of approvals) {
      if (approval.required) {
        approval.status = ApprovalStatus.REJECTED;
        approval.comments = reason;
        approval.timestamp = new Date();
        break;
      }
    }

    this.contentApprovals.set(contentId, approvals);
  }

  getWorkflow(workflowId: string): QAWorkflow | undefined {
    return this.workflows.get(workflowId);
  }

  getAllWorkflows(): QAWorkflow[] {
    return Array.from(this.workflows.values());
  }

  async executeWorkflow(content: string, workflowId: string): Promise<QACheckResult[]> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    const results: QACheckResult[] = [];

    for (const step of workflow.steps.sort((a, b) => a.order - b.order)) {
      if (step.type === StepType.AUTOMATED_CHECK || step.type === StepType.VALIDATION) {
        const result = await this.runQAChecks(content, workflow);
        results.push(result);
      }
    }

    return results;
  }

  private async executeCheck(
    content: string,
    check: QACheck,
  ): Promise<{
    passed: boolean;
    score: number;
    errors: ValidationError[];
    recommendations: any[];
  }> {
    let passed = false;
    let score = 0;
    const errors: ValidationError[] = [];
    const recommendations: any[] = [];

    switch (check.type) {
      case CheckType.ACCURACY:
        const accuracyResult = await this.checkAccuracy(content);
        passed = accuracyResult.passed;
        score = accuracyResult.score;
        errors.push(...accuracyResult.errors);
        break;

      case CheckType.COMPLETENESS:
        const completenessResult = await this.checkCompleteness(content);
        passed = completenessResult.passed;
        score = completenessResult.score;
        errors.push(...completenessResult.errors);
        break;

      case CheckType.CLARITY:
        const clarityResult = await this.checkClarity(content);
        passed = clarityResult.passed;
        score = clarityResult.score;
        errors.push(...clarityResult.errors);
        break;

      case CheckType.CONSISTENCY:
        const consistencyResult = await this.checkConsistency(content);
        passed = consistencyResult.passed;
        score = consistencyResult.score;
        errors.push(...consistencyResult.errors);
        break;

      case CheckType.STYLE:
        const styleResult = await this.checkStyle(content);
        passed = styleResult.passed;
        score = styleResult.score;
        errors.push(...styleResult.errors);
        break;

      case CheckType.GRAMMAR:
        const grammarResult = await this.checkGrammar(content);
        passed = grammarResult.passed;
        score = grammarResult.score;
        errors.push(...grammarResult.errors);
        break;
    }

    if (!passed) {
      recommendations.push({
        type: RecommendationType.ADD_CONTENT,
        description: `Address ${check.type} issues identified in quality check`,
        priority: Priority.MEDIUM,
        impact: Impact.MODERATE,
        effort: Effort.LOW,
      });
    }

    return { passed, score, errors, recommendations };
  }

  private async checkAccuracy(
    content: string,
  ): Promise<{ passed: boolean; score: number; errors: ValidationError[] }> {
    const errors: ValidationError[] = [];
    let score = 0.8;

    const versionNumbers = content.match(/\d+\.\d+(\.\d+)?/g) || [];
    if (versionNumbers.length > 0) {
      score += 0.1;
    }

    const codeBlocks = content.match(/```[\s\S]*?```/g) || [];
    if (codeBlocks.length > 0) {
      score += 0.1;
    }

    if (content.length < 50) {
      errors.push({
        rule: "accuracy-min-length",
        message: "Content appears too short to be accurate documentation",
        severity: IssueSeverity.MEDIUM,
      });
      score -= 0.3;
    }

    return {
      passed: errors.length === 0,
      score: Math.max(0, Math.min(1, score)),
      errors,
    };
  }

  private async checkCompleteness(
    content: string,
  ): Promise<{ passed: boolean; score: number; errors: ValidationError[] }> {
    const errors: ValidationError[] = [];
    let score = 0.3;

    if (/```|`[^`]+`/.test(content)) {
      score += 0.2;
    } else {
      errors.push({
        rule: "completeness-code-examples",
        message: "Missing code examples",
        severity: IssueSeverity.HIGH,
      });
    }

    if (/parameter|arg|option/i.test(content)) {
      score += 0.2;
    } else {
      errors.push({
        rule: "completeness-parameters",
        message: "Missing parameter descriptions",
        severity: IssueSeverity.HIGH,
      });
    }

    if (/return|returns|output/i.test(content)) {
      score += 0.1;
    }

    if (/error|exception|throw/i.test(content)) {
      score += 0.1;
    }

    if (content.length > 100) {
      score += 0.1;
    }

    return {
      passed: score >= 0.7,
      score: Math.min(1, score),
      errors,
    };
  }

  private async checkClarity(
    content: string,
  ): Promise<{ passed: boolean; score: number; errors: ValidationError[] }> {
    const errors: ValidationError[] = [];
    let score = 0.5;

    const sentences = content.split(/[.!?]+/).filter((s) => s.trim().length > 0);
    if (sentences.length === 0) {
      errors.push({
        rule: "clarity-no-sentences",
        message: "No complete sentences found",
        severity: IssueSeverity.CRITICAL,
      });
      return { passed: false, score: 0, errors };
    }

    const avgSentenceLength =
      sentences.reduce((sum, s) => sum + s.split(" ").length, 0) / sentences.length;

    if (avgSentenceLength >= 15 && avgSentenceLength <= 25) {
      score += 0.3;
    } else if (avgSentenceLength > 30) {
      errors.push({
        rule: "clarity-long-sentences",
        message: "Sentences are too long, consider breaking them down",
        severity: IssueSeverity.MEDIUM,
      });
      score -= 0.2;
    }

    const paragraphs = content.split("\n\n").filter((p) => p.trim().length > 0);
    if (paragraphs.length > 1) {
      score += 0.1;
    }

    const hasHeadings = /^#+\s/.test(content);
    if (hasHeadings) {
      score += 0.1;
    }

    return {
      passed: score >= 0.6,
      score: Math.min(1, score),
      errors,
    };
  }

  private async checkConsistency(
    content: string,
  ): Promise<{ passed: boolean; score: number; errors: ValidationError[] }> {
    const errors: ValidationError[] = [];
    let score = 0.6;

    const terms = content.toLowerCase().split(/\s+/);
    const uniqueTerms = new Set(terms);
    const consistencyRatio = uniqueTerms.size / terms.length;

    if (consistencyRatio > 0.3 && consistencyRatio < 0.7) {
      score += 0.2;
    } else if (consistencyRatio > 0.8) {
      errors.push({
        rule: "consistency-terminology",
        message: "Inconsistent terminology detected",
        severity: IssueSeverity.LOW,
      });
    }

    const formatting = content.match(/(\*\*|__|`|```)/g) || [];
    if (formatting.length > 0) {
      score += 0.1;
    }

    const headings = content.match(/^#+\s/gm) || [];
    if (headings.length > 1) {
      score += 0.1;
    }

    return {
      passed: score >= 0.6,
      score: Math.min(1, score),
      errors,
    };
  }

  private async checkStyle(
    content: string,
  ): Promise<{ passed: boolean; score: number; errors: ValidationError[] }> {
    const errors: ValidationError[] = [];
    let score = 0.7;

    if (content.includes("**") || content.includes("__")) {
      score += 0.2;
    }

    if (/^#+\s/.test(content)) {
      score += 0.1;
    }

    const hasList = /^\s*[-*+]\s|^s*\d+\.\s/m.test(content);
    if (hasList) {
      score += 0.1;
    }

    return {
      passed: true,
      score: Math.min(1, score),
      errors,
    };
  }

  private async checkGrammar(
    content: string,
  ): Promise<{ passed: boolean; score: number; errors: ValidationError[] }> {
    const errors: ValidationError[] = [];
    let score = 0.8;

    const commonGrammarIssues = [
      { pattern: /\b(a)\s+[aeiou]/gi, message: 'Use "an" before vowels' },
      { pattern: /\b(an)\s+[^aeiou]/gi, message: 'Use "a" before consonants' },
      { pattern: /\s{2,}/g, message: "Multiple spaces detected" },
    ];

    for (const issue of commonGrammarIssues) {
      if (issue.pattern.test(content)) {
        errors.push({
          rule: "grammar-basic",
          message: issue.message,
          severity: IssueSeverity.LOW,
        });
        score -= 0.1;
      }
    }

    return {
      passed: errors.length === 0,
      score: Math.max(0, score),
      errors,
    };
  }

  private async validateStandard(
    content: string,
    standard: QualityStandard,
  ): Promise<{ score: number; errors: ValidationError[]; warnings: ValidationWarning[] }> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    let totalScore = 0;

    for (const rule of standard.rules) {
      if (!rule.enabled) continue;

      const ruleResult = await this.validateRule(content, rule);
      totalScore += ruleResult.score;

      if (ruleResult.error) {
        errors.push(ruleResult.error);
      }
      if (ruleResult.warning) {
        warnings.push(ruleResult.warning);
      }
    }

    const score =
      standard.rules.length > 0 ? totalScore / standard.rules.filter((r) => r.enabled).length : 0;

    return { score, errors, warnings };
  }

  private async validateRule(
    content: string,
    rule: ValidationRule,
  ): Promise<{ score: number; error?: ValidationError; warning?: ValidationWarning }> {
    const pattern = new RegExp(rule.pattern, "gi");
    const matches = content.match(pattern) || [];

    if (matches.length > 0) {
      return {
        score: 0.5,
        error: {
          rule: rule.id,
          message: rule.description,
          severity: rule.severity,
        },
      };
    }

    return { score: 1.0 };
  }

  private createStepsFromStandards(standards: QualityStandard[]): QAStep[] {
    const steps: QAStep[] = [];
    let order = 1;

    steps.push({
      id: this.generateId(),
      name: "Automated Validation",
      description: "Run automated quality checks",
      type: StepType.AUTOMATED_CHECK,
      required: true,
      order: order++,
      automated: true,
    });

    if (standards.some((s) => s.category === StandardCategory.TECHNICAL)) {
      steps.push({
        id: this.generateId(),
        name: "Technical Review",
        description: "Review technical accuracy and completeness",
        type: StepType.REVIEW,
        required: true,
        order: order++,
        automated: false,
      });
    }

    steps.push({
      id: this.generateId(),
      name: "Final Approval",
      description: "Final content approval",
      type: StepType.APPROVAL,
      required: true,
      order: order++,
      automated: false,
    });

    return steps;
  }

  private createChecksFromStandards(_standards: QualityStandard[]): QACheck[] {
    const checks: QACheck[] = [];

    checks.push({
      id: this.generateId(),
      name: "Accuracy Check",
      description: "Verify technical accuracy",
      type: CheckType.ACCURACY,
      severity: IssueSeverity.HIGH,
      enabled: true,
    });

    checks.push({
      id: this.generateId(),
      name: "Completeness Check",
      description: "Ensure all required information is present",
      type: CheckType.COMPLETENESS,
      severity: IssueSeverity.HIGH,
      enabled: true,
    });

    checks.push({
      id: this.generateId(),
      name: "Clarity Check",
      description: "Check for clear and understandable content",
      type: CheckType.CLARITY,
      severity: IssueSeverity.MEDIUM,
      enabled: true,
    });

    checks.push({
      id: this.generateId(),
      name: "Consistency Check",
      description: "Ensure consistent terminology and formatting",
      type: CheckType.CONSISTENCY,
      severity: IssueSeverity.MEDIUM,
      enabled: true,
    });

    checks.push({
      id: this.generateId(),
      name: "Style Check",
      description: "Verify proper formatting and style",
      type: CheckType.STYLE,
      severity: IssueSeverity.LOW,
      enabled: true,
    });

    checks.push({
      id: this.generateId(),
      name: "Grammar Check",
      description: "Check for grammatical errors",
      type: CheckType.GRAMMAR,
      severity: IssueSeverity.LOW,
      enabled: true,
    });

    return checks;
  }

  private createDefaultApprovals(): QAApproval[] {
    return [
      {
        id: this.generateId(),
        approver: "content-reviewer",
        role: "Content Reviewer",
        required: true,
        status: ApprovalStatus.PENDING,
      },
      {
        id: this.generateId(),
        approver: "technical-reviewer",
        role: "Technical Reviewer",
        required: false,
        status: ApprovalStatus.PENDING,
      },
    ];
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2, 11);
  }

  private convertValidationErrorsToQualityIssues(errors: ValidationError[]): QualityIssue[] {
    return errors.map((error) => ({
      type: error.rule as any,
      description: error.message,
      severity: error.severity,
      location: error.location,
      suggestion: "",
    }));
  }
}
