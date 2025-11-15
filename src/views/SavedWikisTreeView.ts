import {
  TreeDataProvider,
  TreeItem,
  Event,
  EventEmitter,
  TreeItemCollapsibleState,
  Uri,
  Command,
  ThemeIcon,
} from "vscode";
import type { SavedWiki } from "@/application/services/storage/WikiStorageService";
import { WikiStorageService } from "@/application/services/storage/WikiStorageService";
import { LoggingService, createLogger, type Logger } from "@/infrastructure/services";
import { EventBus } from "@/events/EventBus";

export class WikiTreeItem extends TreeItem {
  constructor(
    public readonly wiki: SavedWiki,
    public readonly collapsibleState: TreeItemCollapsibleState,
  ) {
    super(wiki.title, collapsibleState);
    this.tooltip = wiki.filePath;
    this.description = new Date(wiki.createdAt).toLocaleDateString();
    this.command = {
      command: "vscode.open",
      title: "Open Wiki",
      arguments: [Uri.file(wiki.filePath)],
    } as Command;
  }

  iconPath = new ThemeIcon("book");
}

export class SavedWikisTreeDataProvider implements TreeDataProvider<WikiTreeItem> {
  private _onDidChangeTreeData: EventEmitter<WikiTreeItem | undefined | null | void> =
    new EventEmitter<WikiTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: Event<WikiTreeItem | undefined | null | void> =
    this._onDidChangeTreeData.event;
  private logger: Logger;
  private eventUnsubscribe?: () => void;

  constructor(
    private wikiStorage: WikiStorageService,
    private eventBus: EventBus,
    private loggingService: LoggingService,
  ) {
    this.logger = createLogger("SavedWikisTreeDataProvider");
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this.eventUnsubscribe = this.eventBus.subscribe("savedWikisChanged", () => {
      this.logger.debug("savedWikisChanged event received, refreshing tree");
      this.refresh();
    });
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: WikiTreeItem): TreeItem {
    return element;
  }

  async getChildren(element?: WikiTreeItem): Promise<WikiTreeItem[]> {
    try {
      const wikis = await this.wikiStorage.getAllSavedWikis();
      this.logger.debug(`Retrieved ${wikis.length} saved wikis for tree view`);
      return wikis.map((wiki: any) => new WikiTreeItem(wiki, TreeItemCollapsibleState.None));
    } catch (error) {
      this.logger.error("Failed to get saved wikis for tree view", error);
      return [];
    }
  }

  dispose(): void {
    if (this.eventUnsubscribe) {
      this.eventUnsubscribe();
      this.eventUnsubscribe = undefined;
    }
    this._onDidChangeTreeData.dispose();
  }
}
