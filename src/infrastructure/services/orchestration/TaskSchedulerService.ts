import {
  LoggingService,
  createLogger,
  type Logger,
} from "@/infrastructure/services/logging/LoggingService";
import type { CancellationToken } from "vscode";

export enum TaskPriority {
  CRITICAL = 0,
  HIGH = 1,
  MEDIUM = 2,
  LOW = 3,
  IDLE = 4,
}

export interface Task {
  id: string;
  priority: TaskPriority;
  execute: () => Promise<void>;
  estimatedDuration: number;
  cancellationToken?: CancellationToken;
}

export class TaskSchedulerService {
  private queue: Task[] = [];
  private running = new Set<string>();
  private idleTimer?: NodeJS.Timeout;
  private logger: Logger;

  constructor(private loggingService: LoggingService) {
    this.logger = createLogger("TaskSchedulerService");
  }

  async schedule(task: Task): Promise<void> {
    if (task.cancellationToken?.isCancellationRequested) {
      this.logger.debug(`Task ${task.id} cancelled before scheduling`);
      return;
    }

    if (task.priority === TaskPriority.CRITICAL) {
      return this.executeImmediately(task);
    }

    this.queue.push(task);
    this.queue.sort((a, b) => a.priority - b.priority);

    if (task.priority === TaskPriority.HIGH) {
      setImmediate(() => this.processQueue());
    } else {
      this.scheduleIdleProcessing();
    }
  }

  private async executeImmediately(task: Task): Promise<void> {
    this.running.add(task.id);
    try {
      await task.execute();
      this.logger.debug(`Task ${task.id} completed immediately`);
    } catch (error) {
      this.logger.error(`Task ${task.id} failed`, error);
    } finally {
      this.running.delete(task.id);
    }
  }

  private scheduleIdleProcessing(): void {
    if (this.idleTimer) return;

    this.idleTimer = setTimeout(() => {
      this.idleTimer = undefined;
      this.processIdleTasks();
    }, 100);
  }

  private async processIdleTasks(): Promise<void> {
    const maxBatchTime = 50;
    const startTime = Date.now();

    while (Date.now() - startTime < maxBatchTime && this.queue.length > 0) {
      const task = this.queue.shift();
      if (!task) break;

      if (task.cancellationToken?.isCancellationRequested) {
        this.logger.debug(`Task ${task.id} cancelled before execution`);
        continue;
      }

      await this.executeInBackground(task);
    }

    if (this.queue.length > 0) {
      this.scheduleIdleProcessing();
    }
  }

  private async executeInBackground(task: Task): Promise<void> {
    this.running.add(task.id);
    try {
      await task.execute();
      this.logger.debug(`Background task ${task.id} completed`);
    } catch (error) {
      this.logger.error(`Background task ${task.id} failed`, error);
    } finally {
      this.running.delete(task.id);
    }
  }

  private async processQueue(): Promise<void> {
    while (this.queue.length > 0 && this.queue[0].priority === TaskPriority.HIGH) {
      const task = this.queue.shift();
      if (task) {
        await this.executeInBackground(task);
      }
    }
  }

  dispose(): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
    }
    this.queue = [];
    this.running.clear();
  }
}
