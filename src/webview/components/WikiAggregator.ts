export interface WikiPage {
  id: string;
  title: string;
  content: string;
  tags: string[];
  metadata: {
    createdAt: string;
    updatedAt: string;
    author: string;
    version: number;
    status: string;
    projectId: string;
  };
  relationships: Array<{
    source: string;
    target: string;
    type: string;
  }>;
}

export interface WikiAggregatorState {
  pages: WikiPage[];
  selectedPage: WikiPage | null;
  isLoading: boolean;
  error: string | null;
  searchQuery: string;
  selectedTags: string[];
  viewMode: "list" | "graph" | "index";
  statistics: {
    totalPages: number;
    totalTags: number;
    totalRelationships: number;
    lastUpdated: string;
  } | null;
}

export class WikiAggregator {
  private state: WikiAggregatorState = {
    pages: [],
    selectedPage: null,
    isLoading: false,
    error: null,
    searchQuery: "",
    selectedTags: [],
    viewMode: "list",
    statistics: null,
  };

  constructor(private vscode: any) {
    this.initialize();
  }

  private initialize() {
    this.loadWikiPages();
    this.loadStatistics();
    this.setupEventListeners();
  }

  private async loadWikiPages() {
    try {
      this.setState({ isLoading: true, error: null });
      this.vscode.postMessage({
        command: "getAllWikiPages",
        payload: { projectId: "current" },
      });
      this.setState({ isLoading: false });
    } catch (error) {
      this.setState({
        error: "Failed to load wiki pages",
        isLoading: false,
      });
    }
  }

  private async loadStatistics() {
    try {
      this.vscode.postMessage({
        command: "getWikiStatistics",
        payload: { projectId: "current" },
      });
    } catch (error) {
      this.setState({ statistics: null });
    }
  }

  private setupEventListeners() {
    window.addEventListener("message", (event: MessageEvent<{ command: string; payload: any }>) => {
      const message = event.data;

      switch (message.command) {
        case "wikiPageCreated":
          this.handlePageCreated(message.payload);
          break;
        case "wikiPageUpdated":
          this.handlePageUpdated(message.payload);
          break;
        case "wikiPageDeleted":
          this.handlePageDeleted(message.payload);
          break;
        case "wikisAggregated":
          this.handleWikisAggregated(message.payload);
          break;
      }
    });
  }

  private handlePageCreated(payload: any) {
    this.setState((prev) => ({
      pages: [...prev.pages, payload.page],
    }));
    this.loadStatistics();
  }

  private handlePageUpdated(payload: any) {
    this.setState((prev) => ({
      pages: prev.pages.map((p) => (p.id === payload.page.id ? payload.page : p)),
    }));
  }

  private handlePageDeleted(payload: any) {
    this.setState((prev) => ({
      pages: prev.pages.filter((p) => p.id !== payload.pageId),
      selectedPage: prev.selectedPage?.id === payload.pageId ? null : prev.selectedPage,
    }));
    this.loadStatistics();
  }

  private handleWikisAggregated(payload: any) {
    this.loadWikiPages();
    this.loadStatistics();
  }

  async createPage(pageData: Omit<WikiPage, "id" | "metadata">) {
    try {
      await this.vscode.postMessage({
        command: "createWikiPage",
        payload: {
          ...pageData,
          projectId: "current",
        },
      });
    } catch (error) {
      this.setState({ error: "Failed to create wiki page" });
    }
  }

  async aggregateWikis() {
    try {
      this.setState({ isLoading: true });

      await this.vscode.postMessage({
        command: "aggregateWikis",
        payload: {
          projectId: "current",
          strategy: {
            type: "auto",
            rules: [],
          },
        },
      });

      this.setState({ isLoading: false });
    } catch (error) {
      this.setState({
        error: "Failed to aggregate wikis",
        isLoading: false,
      });
    }
  }

  async generateProjectWiki() {
    try {
      this.setState({ isLoading: true });

      await this.vscode.postMessage({
        command: "generateProjectWiki",
        payload: {
          projectId: "current",
        },
      });

      this.setState({ isLoading: false });
    } catch (error) {
      this.setState({
        error: "Failed to generate project wiki",
        isLoading: false,
      });
    }
  }

  async searchPages(query: string) {
    try {
      this.setState({ isLoading: true });

      this.vscode.postMessage({
        command: "searchWikiPages",
        payload: {
          projectId: "current",
          query,
        },
      });
      this.setState({ isLoading: false, searchQuery: query });
    } catch (error) {
      this.setState({
        error: "Failed to search pages",
        isLoading: false,
      });
    }
  }

  selectPage(page: WikiPage | null) {
    this.setState({ selectedPage: page });
  }

  setViewMode(mode: "list" | "graph" | "index") {
    this.setState({ viewMode: mode });
  }

  toggleTag(tag: string) {
    this.setState((prev) => ({
      selectedTags: prev.selectedTags.includes(tag)
        ? prev.selectedTags.filter((t) => t !== tag)
        : [...prev.selectedTags, tag],
    }));
  }

  getFilteredPages(): WikiPage[] {
    const { pages, searchQuery, selectedTags } = this.state;

    return pages.filter((page) => {
      if (
        searchQuery &&
        !page.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !page.content.toLowerCase().includes(searchQuery.toLowerCase())
      ) {
        return false;
      }
      if (selectedTags.length > 0 && !selectedTags.some((tag) => page.tags.includes(tag))) {
        return false;
      }
      return true;
    });
  }

  getAllTags(): string[] {
    const tags = new Set<string>();
    this.state.pages.forEach((page) => {
      page.tags.forEach((tag) => tags.add(tag));
    });
    return Array.from(tags).sort();
  }

  private setState(
    updates:
      | Partial<WikiAggregatorState>
      | ((prev: WikiAggregatorState) => Partial<WikiAggregatorState>),
  ) {
    const next = typeof updates === "function" ? updates(this.state) : updates;
    this.state = { ...this.state, ...next };
    this.render();
  }

  private render() {
    const container = document.getElementById("wiki-aggregator");
    if (!container) return;

    const { pages, selectedPage, isLoading, error, viewMode, statistics } = this.state;
    const filteredPages = this.getFilteredPages();
    const allTags = this.getAllTags();

    container.innerHTML = `
      <div class="wiki-aggregator">
        <div class="wiki-aggregator__header">
          <h2>Wiki Aggregator</h2>
          <div class="wiki-aggregator__actions">
            <button class="btn btn-primary" onclick="wikiAggregator.showCreateModal()">
              Create Page
            </button>
            <button class="btn btn-secondary" onclick="wikiAggregator.aggregateWikis()">
              Aggregate Wikis
            </button>
            <button class="btn btn-secondary" onclick="wikiAggregator.generateProjectWiki()">
              Generate Project Wiki
            </button>
          </div>
        </div>

        ${
          statistics
            ? `
          <div class="wiki-aggregator__stats">
            <div class="stat-card">
              <div class="stat-value">${statistics.totalPages}</div>
              <div class="stat-label">Total Pages</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">${statistics.totalTags}</div>
              <div class="stat-label">Unique Tags</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">${statistics.totalRelationships}</div>
              <div class="stat-label">Relationships</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">${new Date(statistics.lastUpdated).toLocaleDateString()}</div>
              <div class="stat-label">Last Updated</div>
            </div>
          </div>
        `
            : ""
        }

        <div class="wiki-aggregator__controls">
          <div class="view-modes">
            <button class="btn ${viewMode === "list" ? "btn-primary" : "btn-secondary"}"
                    onclick="wikiAggregator.setViewMode('list')">
              List View
            </button>
            <button class="btn ${viewMode === "graph" ? "btn-primary" : "btn-secondary"}"
                    onclick="wikiAggregator.setViewMode('graph')">
              Graph View
            </button>
            <button class="btn ${viewMode === "index" ? "btn-primary" : "btn-secondary"}"
                    onclick="wikiAggregator.setViewMode('index')">
              Index View
            </button>
          </div>

          <div class="search-filters">
            <input
              type="text"
              class="form-control"
              placeholder="Search wiki pages..."
              value="${this.state.searchQuery}"
              oninput="wikiAggregator.searchPages(this.value)"
            />

            <div class="tag-filter">
              <select multiple class="form-control" onchange="wikiAggregator.handleTagChange(this)">
                ${allTags
                  .map(
                    (tag) => `
                  <option value="${tag}" ${this.state.selectedTags.includes(tag) ? "selected" : ""}>
                    ${tag}
                  </option>
                `,
                  )
                  .join("")}
              </select>
            </div>
          </div>
        </div>

        ${error ? `<div class="alert alert-error">${error}</div>` : ""}

        ${isLoading ? '<div class="loading">Processing...</div>' : ""}

        <div class="wiki-aggregator__content">
          ${this.renderViewMode(filteredPages)}
        </div>
      </div>
    `;
  }

  private renderViewMode(pages: WikiPage[]): string {
    const { viewMode, selectedPage } = this.state;

    switch (viewMode) {
      case "list":
        return this.renderListView(pages);
      case "graph":
        return this.renderGraphView(pages);
      case "index":
        return this.renderIndexView(pages);
      default:
        return this.renderListView(pages);
    }
  }

  private renderListView(pages: WikiPage[]): string {
    const { selectedPage } = this.state;

    return `
      <div class="wiki-aggregator__list-view">
        <div class="wiki-pages-list">
          <h3>Wiki Pages (${pages.length})</h3>
          ${pages
            .map(
              (page) => `
            <div class="wiki-page ${selectedPage?.id === page.id ? "selected" : ""}"
                 onclick="wikiAggregator.selectPage(${JSON.stringify(page).replace(/"/g, "&quot;")})">
              <div class="wiki-page__header">
                <h4>${page.title}</h4>
                <div class="wiki-page__meta">
                  <span class="badge">${page.metadata.status}</span>
                  <span class="badge">v${page.metadata.version}</span>
                  <span class="badge">${page.metadata.author}</span>
                </div>
              </div>
              <div class="wiki-page__preview">
                ${page.content.substring(0, 200)}${page.content.length > 200 ? "..." : ""}
              </div>
              <div class="wiki-page__tags">
                ${page.tags.map((tag) => `<span class="tag">${tag}</span>`).join("")}
              </div>
              <div class="wiki-page__date">
                Updated: ${new Date(page.metadata.updatedAt).toLocaleDateString()}
              </div>
            </div>
          `,
            )
            .join("")}
        </div>

        <div class="wiki-page-detail">
          ${
            selectedPage
              ? `
            <div class="wiki-page-detail__content">
              <div class="wiki-page-detail__header">
                <h3>${selectedPage.title}</h3>
                <div class="wiki-page-detail__actions">
                  <button class="btn btn-secondary" onclick="wikiAggregator.editPage('${selectedPage.id}')">
                    Edit
                  </button>
                  <button class="btn btn-danger" onclick="wikiAggregator.deletePage('${selectedPage.id}')">
                    Delete
                  </button>
                </div>
              </div>

              <div class="wiki-page-detail__meta">
                <div><strong>Author:</strong> ${selectedPage.metadata.author}</div>
                <div><strong>Status:</strong> ${selectedPage.metadata.status}</div>
                <div><strong>Version:</strong> ${selectedPage.metadata.version}</div>
                <div><strong>Created:</strong> ${new Date(selectedPage.metadata.createdAt).toLocaleDateString()}</div>
                <div><strong>Updated:</strong> ${new Date(selectedPage.metadata.updatedAt).toLocaleDateString()}</div>
              </div>

              <div class="wiki-page-detail__tags">
                <strong>Tags:</strong>
                ${selectedPage.tags.map((tag) => `<span class="tag">${tag}</span>`).join("")}
              </div>

              <div class="wiki-page-detail__content">
                <h4>Content</h4>
                <div class="wiki-content">
                  ${selectedPage.content.replace(/\n/g, "<br>")}
                </div>
              </div>

              ${
                selectedPage.relationships.length > 0
                  ? `
                <div class="wiki-page-detail__relationships">
                  <h4>Related Pages</h4>
                  <div class="relationships">
                    ${selectedPage.relationships
                      .map(
                        (rel) => `
                      <div class="relationship">
                        <span class="relationship-type">${rel.type}</span>
                        <span class="relationship-target">${rel.target}</span>
                      </div>
                    `,
                      )
                      .join("")}
                  </div>
                </div>
              `
                  : ""
              }
            </div>
          `
              : `
            <div class="wiki-page-detail__empty">
              <p>Select a wiki page to view details</p>
            </div>
          `
          }
        </div>
      </div>
    `;
  }

  private renderGraphView(pages: WikiPage[]): string {
    return `
      <div class="wiki-aggregator__graph-view">
        <div class="graph-container">
          <p>Graph view visualization would be implemented here</p>
          <p>Shows relationships between wiki pages as a network graph</p>
        </div>
      </div>
    `;
  }

  private renderIndexView(pages: WikiPage[]): string {
    return `
      <div class="wiki-aggregator__index-view">
        <div class="index-container">
          <p>Index view would be implemented here</p>
          <p>Shows a comprehensive index of all wiki content</p>
        </div>
      </div>
    `;
  }

  private handleTagChange(select: HTMLSelectElement) {
    const selectedOptions = Array.from(select.selectedOptions, (option) => option.value);
    this.setState({ selectedTags: selectedOptions });
  }

  private showCreateModal() {
    this.vscode.postMessage({ command: "openWikiCreate" });
  }

  private editPage(id: string) {
    this.vscode.postMessage({ command: "editWikiPage", payload: { id } });
  }

  private deletePage(id: string) {
    if (confirm("Are you sure you want to delete this wiki page?")) {
      this.vscode.postMessage({ command: "deleteWikiPage", payload: { id } });
    }
  }
}

(window as Record<string, unknown>).wikiAggregator = null;

document.addEventListener("DOMContentLoaded", () => {
  const api = window.vscode;
  if (!api) {
    return;
  }
  (window as Record<string, unknown>).wikiAggregator = new WikiAggregator(api);
});
