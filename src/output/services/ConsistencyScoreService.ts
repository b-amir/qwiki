export interface ConsistencyMetrics {
  format: number;
  structure: number;
  style: number;
  terminology: number;
  overall: number;
}

export interface ConsistencyReport {
  scores: ConsistencyMetrics;
  issues: string[];
  recommendations: string[];
}

export interface TimePeriod {
  from: string;
  to: string;
}

export interface ConsistencyTrendPoint {
  timestamp: string;
  score: number;
}

export interface ConsistencyTrend {
  points: ConsistencyTrendPoint[];
}

export interface Suggestion {
  type: string;
  message: string;
  priority: number;
}

export class ConsistencyScoreService {
  async scoreConsistency(content: string, baseline: string): Promise<ConsistencyMetrics> {
    const format = this.scoreFormat(content, baseline);
    const structure = this.scoreStructure(content, baseline);
    const style = this.scoreStyle(content, baseline);
    const terminology = this.scoreTerminology(content, baseline);
    const overall = Math.round((format + structure + style + terminology) / 4);
    return { format, structure, style, terminology, overall };
  }

  async compareOutputs(outputs: string[], providerId?: string): Promise<ConsistencyReport> {
    const baseline = outputs[0] || "";
    let total = 0;
    let issues: string[] = [];
    for (const c of outputs) {
      const m = await this.scoreConsistency(c, baseline);
      total += m.overall;
      if (m.format < 70) issues.push("format_inconsistency");
      if (m.structure < 70) issues.push("structure_inconsistency");
      if (m.style < 70) issues.push("style_inconsistency");
      if (m.terminology < 70) issues.push("terminology_inconsistency");
    }
    const avg = Math.round(total / Math.max(1, outputs.length));
    const scores: ConsistencyMetrics = {
      format: avg,
      structure: avg,
      style: avg,
      terminology: avg,
      overall: avg,
    };
    const recommendations = this.recommendationsForIssues(issues);
    return { scores, issues: Array.from(new Set(issues)), recommendations };
  }

  async trackConsistencyTrend(projectId: string, timeframe: TimePeriod): Promise<ConsistencyTrend> {
    const now = Date.now();
    const points: ConsistencyTrendPoint[] = [];
    for (let i = 6; i >= 0; i--)
      points.push({
        timestamp: new Date(now - i * 24 * 3600 * 1000).toISOString(),
        score: 75 + ((i % 3) - 1) * 5,
      });
    return { points };
  }

  async suggestConsistencyImprovements(content: string, baseline: string): Promise<Suggestion[]> {
    const m = await this.scoreConsistency(content, baseline);
    const s: Suggestion[] = [];
    if (m.format < 80)
      s.push({
        type: "format",
        message: "Align headings and code fences with baseline",
        priority: 2,
      });
    if (m.structure < 80)
      s.push({
        type: "structure",
        message: "Use consistent section ordering and bullet styles",
        priority: 2,
      });
    if (m.style < 80)
      s.push({ type: "style", message: "Normalize tone, tense, and sentence length", priority: 3 });
    if (m.terminology < 80)
      s.push({
        type: "terminology",
        message: "Standardize key terms to project glossary",
        priority: 1,
      });
    return s;
  }

  private scoreFormat(content: string, baseline: string): number {
    const h1 = (s: string) => (s.match(/^#\s+/gm) || []).length;
    const fences = (s: string) => (s.match(/```/g) || []).length % 2 === 0;
    let score = 60;
    if (h1(content) === h1(baseline)) score += 15;
    else score += 5;
    if (fences(content) === fences(baseline)) score += 15;
    else score += 5;
    return Math.max(0, Math.min(100, score));
  }

  private scoreStructure(content: string, baseline: string): number {
    const sec = (s: string) => (s.match(/^##\s+/gm) || []).length;
    const list = (s: string) => (s.match(/\n-\s|\n\d+\./g) || []).length;
    const a = sec(content),
      b = sec(baseline);
    const la = list(content),
      lb = list(baseline);
    const secScore = 50 + 25 * (1 - Math.min(1, Math.abs(a - b) / Math.max(1, b)));
    const listScore = 50 + 25 * (1 - Math.min(1, Math.abs(la - lb) / Math.max(1, lb)));
    return Math.round(Math.max(0, Math.min(100, (secScore + listScore) / 2)));
  }

  private scoreStyle(content: string, baseline: string): number {
    const avgLen = (s: string) => {
      const sentences = s
        .split(/[.!?]+/)
        .map((x) => x.trim())
        .filter(Boolean);
      if (sentences.length === 0) return 0;
      const sum = sentences.reduce((n, cur) => n + cur.length, 0);
      return sum / sentences.length;
    };
    const a = avgLen(content);
    const b = avgLen(baseline);
    if (b === 0) return 70;
    const diff = Math.abs(a - b) / b;
    return Math.max(0, Math.min(100, Math.round(90 * (1 - Math.min(1, diff)) + 10)));
  }

  private scoreTerminology(content: string, baseline: string): number {
    const terms = (s: string) =>
      new Set(
        (s.match(/`[^`]+`|\b[A-Za-z][A-Za-z0-9_-]{2,}\b/g) || []).map((x) => x.toLowerCase()),
      );
    const a = terms(content);
    const b = terms(baseline);
    if (b.size === 0) return 70;
    let overlap = 0;
    for (const t of a) if (b.has(t)) overlap++;
    const ratio = overlap / b.size;
    return Math.max(0, Math.min(100, Math.round(60 + ratio * 40)));
  }

  private recommendationsForIssues(issues: string[]): string[] {
    const set = new Set(issues);
    const out: string[] = [];
    if (set.has("format_inconsistency"))
      out.push("Adopt a single documentation format baseline and enforce headings and fences");
    if (set.has("structure_inconsistency"))
      out.push("Standardize section order and list styles across outputs");
    if (set.has("style_inconsistency"))
      out.push("Define a style guide for tone and sentence structure");
    if (set.has("terminology_inconsistency"))
      out.push("Create a glossary and replace variants with canonical terms");
    return out;
  }
}
