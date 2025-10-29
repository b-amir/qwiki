export interface QualityMetrics {
  clarity: number;
  completeness: number;
  accuracy: number;
  consistency: number;
  overall: number;
}

export interface QualityIssue {
  type: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  location?: string;
  suggestion?: string;
}

export interface QualityReport {
  metrics: QualityMetrics;
  issues: QualityIssue[];
  recommendations: Array<{
    type: string;
    description: string;
    priority: 'low' | 'medium' | 'high' | 'urgent';
    impact: 'minimal' | 'moderate' | 'significant' | 'critical';
    effort: 'minimal' | 'low' | 'moderate' | 'high';
  }>;
  score: number;
  completedAt: string;
}

export interface QualityTrend {
  timeframe: {
    startDate: string;
    endDate: string;
  };
  metrics: QualityMetrics[];
  trend: 'improving' | 'declining' | 'stable' | 'fluctuating';
  improvement: number;
}

export interface QualityDashboardState {
  currentReport: QualityReport | null;
  historicalReports: QualityReport[];
  trend: QualityTrend | null;
  isLoading: boolean;
  error: string | null;
  selectedContent: string;
  analysisContext: {
    codeType: string;
    language: string;
    complexity: string;
    audience: string;
    purpose: string;
  };
  viewMode: 'dashboard' | 'reports' | 'trends' | 'improvements';
}

export class QualityDashboard {
  private state: QualityDashboardState = {
    currentReport: null,
    historicalReports: [],
    trend: null,
    isLoading: false,
    error: null,
    selectedContent: '',
    analysisContext: {
      codeType: 'function',
      language: 'javascript',
      complexity: 'moderate',
      audience: 'intermediate',
      purpose: 'documentation'
    },
    viewMode: 'dashboard'
  };

  constructor(private vscode: any) {
    this.initialize();
  }

  private initialize() {
    this.setupEventListeners();
  }

  private setupEventListeners() {
    window.addEventListener('message', (event: MessageEvent<{ command: string; payload: any }>) => {
      const message = event.data;

      switch (message.command) {
        case 'qualityMetricsCalculated':
          this.handleMetricsCalculated(message.payload);
          break;
        case 'qualityReportGenerated':
          this.handleReportGenerated(message.payload);
          break;
        case 'qualityTracked':
          this.handleTrendUpdated(message.payload);
          break;
        case 'improvementsSuggested':
          this.handleImprovementsSuggested(message.payload);
          break;
      }
    });
  }

  private handleMetricsCalculated(payload: any) {
    if (this.state.currentReport) {
      this.setState(prev => ({
        currentReport: {
          ...prev.currentReport!,
          metrics: payload.metrics,
          score: payload.qualityScore,
          completedAt: new Date().toISOString()
        }
      }));
    }
  }

  private handleReportGenerated(payload: any) {
    this.setState(prev => ({
      currentReport: payload.qualityReport,
      historicalReports: [...prev.historicalReports, payload.qualityReport]
    }));
  }

  private handleTrendUpdated(payload: any) {
    this.setState({ trend: payload.qualityTrend });
  }

  private handleImprovementsSuggested(payload: any) {
    if (this.state.currentReport) {
      this.setState(prev => ({
        currentReport: {
          ...prev.currentReport!,
          recommendations: payload.recommendations
        }
      }));
    }
  }

  async analyzeContent() {
    const { selectedContent, analysisContext } = this.state;

    if (!selectedContent.trim()) {
      this.setState({ error: 'Please provide content to analyze' });
      return;
    }

    try {
      this.setState({ isLoading: true, error: null });

      await this.vscode.postMessage({
        command: 'calculateQualityMetrics',
        payload: {
          content: selectedContent,
          context: analysisContext
        }
      });

      await this.vscode.postMessage({
        command: 'generateQualityReport',
        payload: {
          content: selectedContent,
          context: analysisContext
        }
      });

      this.setState({ isLoading: false });
    } catch (error) {
      this.setState({
        error: 'Failed to analyze content',
        isLoading: false
      });
    }
  }

  async generateImprovementPlan() {
    if (!this.state.currentReport) {
      this.setState({ error: 'Please analyze content first' });
      return;
    }

    try {
      this.setState({ isLoading: true });

      await this.vscode.postMessage({
        command: 'createImprovementPlan',
        payload: {
          content: this.state.selectedContent
        }
      });

      this.setState({ isLoading: false });
    } catch (error) {
      this.setState({
        error: 'Failed to generate improvement plan',
        isLoading: false
      });
    }
  }

  async runQAChecks() {
    const { selectedContent, analysisContext } = this.state;

    if (!selectedContent.trim()) {
      this.setState({ error: 'Please provide content to analyze' });
      return;
    }

    try {
      this.setState({ isLoading: true });

      await this.vscode.postMessage({
        command: 'runQAChecks',
        payload: {
          content: selectedContent,
          context: analysisContext
        }
      });

      this.setState({ isLoading: false });
    } catch (error) {
      this.setState({
        error: 'Failed to run QA checks',
        isLoading: false
      });
    }
  }

  setContent(content: string) {
    this.setState({ selectedContent: content });
  }

  setAnalysisContext(context: Partial<QualityDashboardState['analysisContext']>) {
    this.setState(prev => ({
      analysisContext: { ...prev.analysisContext, ...context }
    }));
  }

  setViewMode(mode: 'dashboard' | 'reports' | 'trends' | 'improvements') {
    this.setState({ viewMode: mode });
  }

  getScoreColor(score: number): string {
    if (score >= 0.9) return '#28a745';
    if (score >= 0.8) return '#6c757d';
    if (score >= 0.7) return '#fd7e14';
    if (score >= 0.6) return '#dc3545';
    return '#dc3545';
  }

  getSeverityColor(severity: string): string {
    switch (severity) {
      case 'low': return '#28a745';
      case 'medium': return '#fd7e14';
      case 'high': return '#dc3545';
      case 'critical': return '#6f42c1';
      default: return '#6c757d';
    }
  }

  private setState(
    updates: Partial<QualityDashboardState> | ((prev: QualityDashboardState) => Partial<QualityDashboardState>)
  ) {
    const next = typeof updates === 'function' ? updates(this.state) : updates;
    this.state = { ...this.state, ...next };
    this.render();
  }

  private render() {
    const container = document.getElementById('quality-dashboard');
    if (!container) return;

    const { currentReport, viewMode, isLoading, error } = this.state;

    container.innerHTML = `
      <div class="quality-dashboard">
        <div class="quality-dashboard__header">
          <h2>Quality Dashboard</h2>
          <div class="view-modes">
            <button class="btn ${viewMode === 'dashboard' ? 'btn-primary' : 'btn-secondary'}"
                    onclick="qualityDashboard.setViewMode('dashboard')">
              Dashboard
            </button>
            <button class="btn ${viewMode === 'reports' ? 'btn-primary' : 'btn-secondary'}"
                    onclick="qualityDashboard.setViewMode('reports')">
              Reports
            </button>
            <button class="btn ${viewMode === 'trends' ? 'btn-primary' : 'btn-secondary'}"
                    onclick="qualityDashboard.setViewMode('trends')">
              Trends
            </button>
            <button class="btn ${viewMode === 'improvements' ? 'btn-primary' : 'btn-secondary'}"
                    onclick="qualityDashboard.setViewMode('improvements')">
              Improvements
            </button>
          </div>
        </div>

        ${error ? `<div class="alert alert-error">${error}</div>` : ''}

        ${this.renderViewMode()}
      </div>
    `;
  }

  private renderViewMode(): string {
    const { viewMode } = this.state;

    switch (viewMode) {
      case 'dashboard':
        return this.renderDashboard();
      case 'reports':
        return this.renderReports();
      case 'trends':
        return this.renderTrends();
      case 'improvements':
        return this.renderImprovements();
      default:
        return this.renderDashboard();
    }
  }

  private renderDashboard(): string {
    const { currentReport, selectedContent, analysisContext, isLoading } = this.state;

    return `
      <div class="quality-dashboard__dashboard">
        <div class="content-input-section">
          <h3>Analyze Content</h3>
          <div class="input-controls">
            <div class="context-controls">
              <select class="form-control" onchange="qualityDashboard.setAnalysisContext({codeType: this.value})">
                <option value="function">Function</option>
                <option value="class">Class</option>
                <option value="module">Module</option>
                <option value="file">File</option>
              </select>

              <select class="form-control" onchange="qualityDashboard.setAnalysisContext({language: this.value})">
                <option value="javascript">JavaScript</option>
                <option value="typescript">TypeScript</option>
                <option value="python">Python</option>
                <option value="java">Java</option>
                <option value="csharp">C#</option>
              </select>

              <select class="form-control" onchange="qualityDashboard.setAnalysisContext({complexity: this.value})">
                <option value="simple">Simple</option>
                <option value="moderate">Moderate</option>
                <option value="complex">Complex</option>
                <option value="advanced">Advanced</option>
              </select>

              <select class="form-control" onchange="qualityDashboard.setAnalysisContext({audience: this.value})">
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
                <option value="mixed">Mixed</option>
              </select>

              <select class="form-control" onchange="qualityDashboard.setAnalysisContext({purpose: this.value})">
                <option value="documentation">Documentation</option>
                <option value="tutorial">Tutorial</option>
                <option value="explanation">Explanation</option>
                <option value="overview">Overview</option>
              </select>
            </div>

            <textarea
              class="form-control content-input"
              placeholder="Paste your code or documentation here to analyze quality..."
              rows="8"
              oninput="qualityDashboard.setContent(this.value)"
            >${selectedContent}</textarea>

            <div class="analysis-actions">
              <button class="btn btn-primary" onclick="qualityDashboard.analyzeContent()" ${isLoading ? 'disabled' : ''}>
                ${isLoading ? 'Analyzing...' : 'Analyze Quality'}
              </button>
              <button class="btn btn-secondary" onclick="qualityDashboard.runQAChecks()" ${isLoading ? 'disabled' : ''}>
                ${isLoading ? 'Running...' : 'Run QA Checks'}
              </button>
              <button class="btn btn-secondary" onclick="qualityDashboard.generateImprovementPlan()"
                      ${isLoading || !currentReport ? 'disabled' : ''}>
                ${isLoading ? 'Generating...' : 'Generate Improvements'}
              </button>
            </div>
          </div>
        </div>

        ${currentReport ? this.renderQualityMetrics(currentReport) : ''}
      </div>
    `;
  }

  private renderQualityMetrics(report: QualityReport): string {
    const { metrics, issues, recommendations, score } = report;

    return `
      <div class="quality-metrics">
        <h3>Quality Assessment</h3>

        <div class="metrics-overview">
          <div class="overall-score">
            <div class="score-circle" style="border-color: ${this.getScoreColor(score)}">
              <span class="score-value" style="color: ${this.getScoreColor(score)}">
                ${Math.round(score * 100)}%
              </span>
            </div>
            <div class="score-label">Overall Quality</div>
          </div>

          <div class="metrics-breakdown">
            <div class="metric">
              <div class="metric-label">Clarity</div>
              <div class="metric-bar">
                <div class="metric-fill" style="width: ${metrics.clarity * 100}%; background: ${this.getScoreColor(metrics.clarity)}"></div>
              </div>
              <div class="metric-value">${Math.round(metrics.clarity * 100)}%</div>
            </div>

            <div class="metric">
              <div class="metric-label">Completeness</div>
              <div class="metric-bar">
                <div class="metric-fill" style="width: ${metrics.completeness * 100}%; background: ${this.getScoreColor(metrics.completeness)}"></div>
              </div>
              <div class="metric-value">${Math.round(metrics.completeness * 100)}%</div>
            </div>

            <div class="metric">
              <div class="metric-label">Accuracy</div>
              <div class="metric-bar">
                <div class="metric-fill" style="width: ${metrics.accuracy * 100}%; background: ${this.getScoreColor(metrics.accuracy)}"></div>
              </div>
              <div class="metric-value">${Math.round(metrics.accuracy * 100)}%</div>
            </div>

            <div class="metric">
              <div class="metric-label">Consistency</div>
              <div class="metric-bar">
                <div class="metric-fill" style="width: ${metrics.consistency * 100}%; background: ${this.getScoreColor(metrics.consistency)}"></div>
              </div>
              <div class="metric-value">${Math.round(metrics.consistency * 100)}%</div>
            </div>
          </div>
        </div>

        ${issues.length > 0 ? `
          <div class="quality-issues">
            <h4>Issues Found (${issues.length})</h4>
            <div class="issues-list">
              ${issues.map(issue => `
                <div class="issue" style="border-left: 4px solid ${this.getSeverityColor(issue.severity)}">
                  <div class="issue-header">
                    <span class="issue-type">${issue.type}</span>
                    <span class="issue-severity" style="color: ${this.getSeverityColor(issue.severity)}">${issue.severity}</span>
                  </div>
                  <div class="issue-description">${issue.description}</div>
                  ${issue.suggestion ? `<div class="issue-suggestion"><strong>Suggestion:</strong> ${issue.suggestion}</div>` : ''}
                  ${issue.location ? `<div class="issue-location"><strong>Location:</strong> ${issue.location}</div>` : ''}
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}

        ${recommendations.length > 0 ? `
          <div class="quality-recommendations">
            <h4>Recommendations (${recommendations.length})</h4>
            <div class="recommendations-list">
              ${recommendations.map(rec => `
                <div class="recommendation">
                  <div class="recommendation-header">
                    <span class="recommendation-type">${rec.type}</span>
                    <div class="recommendation-meta">
                      <span class="badge" style="background: ${this.getPriorityColor(rec.priority)}">${rec.priority}</span>
                      <span class="badge" style="background: ${this.getImpactColor(rec.impact)}">${rec.impact}</span>
                      <span class="badge" style="background: ${this.getEffortColor(rec.effort)}">${rec.effort}</span>
                    </div>
                  </div>
                  <div class="recommendation-description">${rec.description}</div>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}

        <div class="report-footer">
          <div class="report-date">
            Analyzed: ${new Date(report.completedAt).toLocaleString()}
          </div>
        </div>
      </div>
    `;
  }

  private renderReports(): string {
    const { historicalReports } = this.state;

    return `
      <div class="quality-reports">
        <h3>Historical Reports</h3>
        ${historicalReports.length === 0 ?
          '<p>No reports available yet. Analyze some content to generate reports.</p>' :
          historicalReports.map(report => `
            <div class="report-card">
              <div class="report-card__header">
                <h4>Quality Report</h4>
                <div class="report-score" style="color: ${this.getScoreColor(report.score)}">
                  ${Math.round(report.score * 100)}%
                </div>
              </div>
              <div class="report-card__metrics">
                <span>Clarity: ${Math.round(report.metrics.clarity * 100)}%</span>
                <span>Completeness: ${Math.round(report.metrics.completeness * 100)}%</span>
                <span>Accuracy: ${Math.round(report.metrics.accuracy * 100)}%</span>
                <span>Consistency: ${Math.round(report.metrics.consistency * 100)}%</span>
              </div>
              <div class="report-card__footer">
                <span>${new Date(report.completedAt).toLocaleDateString()}</span>
                <span>${report.issues.length} issues</span>
              </div>
            </div>
          `).join('')
        }
      </div>
    `;
  }

  private renderTrends(): string {
    const { trend } = this.state;

    return `
      <div class="quality-trends">
        <h3>Quality Trends</h3>
        ${trend ? `
          <div class="trend-overview">
            <div class="trend-indicator">
              <div class="trend-icon trend-${trend.trend}">${this.getTrendIcon(trend.trend)}</div>
              <div class="trend-info">
                <div class="trend-label">${trend.trend.charAt(0).toUpperCase() + trend.trend.slice(1)}</div>
                <div class="trend-value">${trend.improvement > 0 ? '+' : ''}${trend.improvement.toFixed(1)}%</div>
              </div>
            </div>
            <div class="trend-period">
              ${new Date(trend.timeframe.startDate).toLocaleDateString()} - ${new Date(trend.timeframe.endDate).toLocaleDateString()}
            </div>
          </div>
        ` : '<p>No trend data available yet. Analyze content over time to see trends.</p>'}
      </div>
    `;
  }

  private renderImprovements(): string {
    const { currentReport } = this.state;

    return `
      <div class="quality-improvements">
        <h3>Improvement Suggestions</h3>
        ${currentReport && currentReport.recommendations.length > 0 ?
          currentReport.recommendations.map(rec => `
            <div class="improvement-card">
              <div class="improvement-card__header">
                <h4>${rec.type}</h4>
                <div class="improvement-meta">
                  <span class="badge" style="background: ${this.getPriorityColor(rec.priority)}">${rec.priority}</span>
                  <span class="badge" style="background: ${this.getImpactColor(rec.impact)}">${rec.impact}</span>
                  <span class="badge" style="background: ${this.getEffortColor(rec.effort)}">${rec.effort}</span>
                </div>
              </div>
              <div class="improvement-card__description">${rec.description}</div>
            </div>
          `).join('') :
          '<p>No improvement suggestions available. Analyze content to get recommendations.</p>'
        }
      </div>
    `;
  }

  private getPriorityColor(priority: string): string {
    switch (priority) {
      case 'urgent': return '#dc3545';
      case 'high': return '#fd7e14';
      case 'medium': return '#6c757d';
      case 'low': return '#28a745';
      default: return '#6c757d';
    }
  }

  private getImpactColor(impact: string): string {
    switch (impact) {
      case 'critical': return '#6f42c1';
      case 'significant': return '#dc3545';
      case 'moderate': return '#fd7e14';
      case 'minimal': return '#28a745';
      default: return '#6c757d';
    }
  }

  private getEffortColor(effort: string): string {
    switch (effort) {
      case 'high': return '#dc3545';
      case 'moderate': return '#fd7e14';
      case 'low': return '#6c757d';
      case 'minimal': return '#28a745';
      default: return '#6c757d';
    }
  }

  private getTrendIcon(trend: string): string {
    switch (trend) {
      case 'improving': return '📈';
      case 'declining': return '📉';
      case 'stable': return '➡️';
      case 'fluctuating': return '📊';
      default: return '❓';
    }
  }
}

(window as Record<string, unknown>).qualityDashboard = null;

document.addEventListener('DOMContentLoaded', () => {
  const api = window.vscode;
  if (!api) {
    return;
  }
  (window as Record<string, unknown>).qualityDashboard = new QualityDashboard(api);
});
