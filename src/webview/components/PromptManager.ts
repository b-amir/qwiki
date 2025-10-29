export interface PromptTemplate {
  id: string;
  name: string;
  version: string;
  content: string;
  category: string;
  language: string;
  provider: string;
  complexity: string;
  effectiveness?: number;
  createdAt: string;
  updatedAt: string;
}

export interface PromptManagerState {
  templates: PromptTemplate[];
  selectedTemplate: PromptTemplate | null;
  isLoading: boolean;
  error: string | null;
  filter: {
    category: string;
    provider: string;
    search: string;
  };
}

export class PromptManager {
  private state: PromptManagerState = {
    templates: [],
    selectedTemplate: null,
    isLoading: false,
    error: null,
    filter: {
      category: "all",
      provider: "all",
      search: "",
    },
  };

  constructor(private vscode: any) {
    this.initialize();
  }

  private initialize() {
    this.loadTemplates();
    this.setupEventListeners();
  }

  private async loadTemplates() {
    try {
      this.setState({ isLoading: true, error: null });

      this.vscode.postMessage({
        command: "getAllPromptTemplates",
        payload: {},
      });

      this.setState({ isLoading: false });
    } catch (error) {
      this.setState({
        error: "Failed to load templates",
        isLoading: false,
      });
    }
  }

  private setupEventListeners() {
    window.addEventListener("message", (event: MessageEvent<{ command: string; payload: any }>) => {
      const message = event.data;

      switch (message.command) {
        case "promptTemplateCreated":
          this.handleTemplateCreated(message.payload);
          break;
        case "promptTemplateUpdated":
          this.handleTemplateUpdated(message.payload);
          break;
        case "promptTemplateDeleted":
          this.handleTemplateDeleted(message.payload);
          break;
      }
    });
  }

  private handleTemplateCreated(payload: any) {
    this.setState((prev) => ({
      templates: [...prev.templates, payload.template],
    }));
  }

  private handleTemplateUpdated(payload: any) {
    this.setState((prev) => ({
      templates: prev.templates.map((t) => (t.id === payload.template.id ? payload.template : t)),
    }));
  }

  private handleTemplateDeleted(payload: any) {
    this.setState((prev) => ({
      templates: prev.templates.filter((t) => t.id !== payload.templateId),
      selectedTemplate:
        prev.selectedTemplate?.id === payload.templateId ? null : prev.selectedTemplate,
    }));
  }

  async createTemplate(template: Omit<PromptTemplate, "id" | "createdAt" | "updatedAt">) {
    try {
      await this.vscode.postMessage({
        command: "createPromptTemplate",
        payload: template,
      });
    } catch (error) {
      this.setState({ error: "Failed to create template" });
    }
  }

  async updateTemplate(id: string, updates: Partial<PromptTemplate>) {
    try {
      await this.vscode.postMessage({
        command: "updatePromptTemplate",
        payload: { id, ...updates },
      });
    } catch (error) {
      this.setState({ error: "Failed to update template" });
    }
  }

  async deleteTemplate(id: string) {
    try {
      await this.vscode.postMessage({
        command: "deletePromptTemplate",
        payload: { id },
      });
    } catch (error) {
      this.setState({ error: "Failed to delete template" });
    }
  }

  selectTemplate(template: PromptTemplate | null) {
    this.setState({ selectedTemplate: template });
  }

  setFilter(filter: Partial<PromptManagerState["filter"]>) {
    this.setState((prev) => ({
      filter: { ...prev.filter, ...filter },
    }));
  }

  getFilteredTemplates(): PromptTemplate[] {
    const { templates, filter } = this.state;

    return templates.filter((template) => {
      if (filter.category !== "all" && template.category !== filter.category) {
        return false;
      }
      if (filter.provider !== "all" && template.provider !== filter.provider) {
        return false;
      }
      if (
        filter.search &&
        !template.name.toLowerCase().includes(filter.search.toLowerCase()) &&
        !template.content.toLowerCase().includes(filter.search.toLowerCase())
      ) {
        return false;
      }
      return true;
    });
  }

  private setState(
    updates: Partial<PromptManagerState> | ((prev: PromptManagerState) => Partial<PromptManagerState>)
  ) {
    const next = typeof updates === 'function' ? updates(this.state) : updates;
    this.state = { ...this.state, ...next };
    this.render();
  }

  private render() {
    const container = document.getElementById("prompt-manager");
    if (!container) return;

    const { templates, selectedTemplate, isLoading, error, filter } = this.state;
    const filteredTemplates = this.getFilteredTemplates();

    container.innerHTML = `
      <div class="prompt-manager">
        <div class="prompt-manager__header">
          <h2>Prompt Template Manager</h2>
          <button class="btn btn-primary" onclick="promptManager.showCreateModal()">
            Create Template
          </button>
        </div>

        <div class="prompt-manager__filters">
          <select class="form-control" onchange="promptManager.setFilter({category: this.value})">
            <option value="all">All Categories</option>
            <option value="documentation">Documentation</option>
            <option value="explanation">Explanation</option>
            <option value="summary">Summary</option>
            <option value="analysis">Analysis</option>
            <option value="custom">Custom</option>
          </select>

          <select class="form-control" onchange="promptManager.setFilter({provider: this.value})">
            <option value="all">All Providers</option>
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic</option>
            <option value="google">Google</option>
          </select>

          <input
            type="text"
            class="form-control"
            placeholder="Search templates..."
            value="${filter.search}"
            oninput="promptManager.setFilter({search: this.value})"
          />
        </div>

        ${error ? `<div class="alert alert-error">${error}</div>` : ""}

        ${isLoading ? '<div class="loading">Loading templates...</div>' : ""}

        <div class="prompt-manager__content">
          <div class="prompt-manager__list">
            <h3>Templates (${filteredTemplates.length})</h3>
            ${filteredTemplates
              .map(
                (template) => `
              <div class="prompt-template ${selectedTemplate?.id === template.id ? "selected" : ""}"
                   onclick="promptManager.selectTemplate(${JSON.stringify(template).replace(/"/g, "&quot;")})">
                <div class="prompt-template__header">
                  <h4>${template.name}</h4>
                  <div class="prompt-template__meta">
                    <span class="badge">${template.category}</span>
                    <span class="badge">${template.provider}</span>
                    <span class="badge">${template.complexity}</span>
                  </div>
                </div>
                <div class="prompt-template__preview">
                  ${template.content.substring(0, 150)}${template.content.length > 150 ? "..." : ""}
                </div>
              </div>
            `,
              )
              .join("")}
          </div>

          <div class="prompt-manager__detail">
            ${
              selectedTemplate
                ? `
              <div class="prompt-template-detail">
                <div class="prompt-template-detail__header">
                  <h3>${selectedTemplate.name}</h3>
                  <div class="prompt-template-detail__actions">
                    <button class="btn btn-secondary" onclick="promptManager.editTemplate('${selectedTemplate.id}')">
                      Edit
                    </button>
                    <button class="btn btn-danger" onclick="promptManager.deleteTemplate('${selectedTemplate.id}')">
                      Delete
                    </button>
                  </div>
                </div>

                <div class="prompt-template-detail__meta">
                  <div><strong>Version:</strong> ${selectedTemplate.version}</div>
                  <div><strong>Category:</strong> ${selectedTemplate.category}</div>
                  <div><strong>Provider:</strong> ${selectedTemplate.provider}</div>
                  <div><strong>Complexity:</strong> ${selectedTemplate.complexity}</div>
                  <div><strong>Language:</strong> ${selectedTemplate.language}</div>
                  ${selectedTemplate.effectiveness ? `<div><strong>Effectiveness:</strong> ${selectedTemplate.effectiveness}/10</div>` : ""}
                  <div><strong>Created:</strong> ${new Date(selectedTemplate.createdAt).toLocaleDateString()}</div>
                </div>

                <div class="prompt-template-detail__content">
                  <h4>Content</h4>
                  <pre><code>${selectedTemplate.content}</code></pre>
                </div>
              </div>
            `
                : `
              <div class="prompt-template-detail__empty">
                <p>Select a template to view details</p>
              </div>
            `
            }
          </div>
        </div>
      </div>
    `;
  }

  private showCreateModal() {
    this.vscode.postMessage({ command: "openPromptTemplateCreate" });
  }

  private editTemplate(id: string) {
    this.vscode.postMessage({ command: "editPromptTemplate", payload: { id } });
  }
}

(window as Record<string, unknown>).promptManager = null;

document.addEventListener("DOMContentLoaded", () => {
  const api = window.vscode;
  if (!api) {
    return;
  }
  (window as Record<string, unknown>).promptManager = new PromptManager(api);
});
