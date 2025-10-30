import { EventEmitter } from "events";

export enum TaskPriority {
  LOW = 0,
  NORMAL = 1,
  HIGH = 2,
  CRITICAL = 3,
}

export enum TaskStatus {
  PENDING = "pending",
  RUNNING = "running",
  COMPLETED = "completed",
  FAILED = "failed",
  CANCELLED = "cancelled",
}

export interface BackgroundTask<T = any> {
  id: string;
  name: string;
  execute: () => Promise<T>;
  priority: TaskPriority;
  status: TaskStatus;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  result?: T;
  error?: Error;
  retryCount: number;
  maxRetries: number;
  retryDelay: number;
  progress?: number;
  onCancel?: () => void;
}

export interface QueueStatistics {
  totalTasks: number;
  pendingTasks: number;
  runningTasks: number;
  completedTasks: number;
  failedTasks: number;
  cancelledTasks: number;
  averageExecutionTime: number;
  successRate: number;
}

export class BackgroundProcessingService extends EventEmitter {
  private taskQueue: BackgroundTask[] = [];
  private runningTasks = new Map<string, BackgroundTask>();
  private maxConcurrentTasks = 3;
  private isProcessing = false;
  private statistics = {
    totalTasks: 0,
    completedTasks: 0,
    failedTasks: 0,
    cancelledTasks: 0,
    totalExecutionTime: 0,
  };

  enqueueTask<T>(
    name: string,
    execute: () => Promise<T>,
    priority: TaskPriority = TaskPriority.NORMAL,
    options: {
      maxRetries?: number;
      retryDelay?: number;
      onCancel?: () => void;
    } = {},
  ): string {
    const taskId = this.generateTaskId();
    const task: BackgroundTask<T> = {
      id: taskId,
      name,
      execute,
      priority,
      status: TaskStatus.PENDING,
      createdAt: Date.now(),
      retryCount: 0,
      maxRetries: options.maxRetries ?? 3,
      retryDelay: options.retryDelay ?? 1000,
      onCancel: options.onCancel,
    };

    this.taskQueue.push(task);
    this.taskQueue.sort((a, b) => b.priority - a.priority);
    this.statistics.totalTasks++;

    this.emit("taskEnqueued", task);
    this.processQueue();

    return taskId;
  }

  dequeueTask(taskId: string): boolean {
    const taskIndex = this.taskQueue.findIndex((task) => task.id === taskId);
    if (taskIndex === -1) {
      return false;
    }

    const task = this.taskQueue[taskIndex];
    task.status = TaskStatus.CANCELLED;
    this.taskQueue.splice(taskIndex, 1);
    this.statistics.cancelledTasks++;

    if (task.onCancel) {
      task.onCancel();
    }

    this.emit("taskCancelled", task);
    return true;
  }

  getTaskStatus(taskId: string): TaskStatus | null {
    const task = this.findTask(taskId);
    return task ? task.status : null;
  }

  getTask(taskId: string): BackgroundTask | null {
    return this.findTask(taskId);
  }

  async processQueue(): Promise<void> {
    if (this.isProcessing || this.runningTasks.size >= this.maxConcurrentTasks) {
      return;
    }

    this.isProcessing = true;

    while (this.taskQueue.length > 0 && this.runningTasks.size < this.maxConcurrentTasks) {
      const task = this.taskQueue.shift();
      if (!task) break;

      this.runningTasks.set(task.id, task);
      this.executeTask(task);
    }

    this.isProcessing = false;
  }

  pauseQueue(): void {
    this.isProcessing = false;
  }

  resumeQueue(): void {
    this.processQueue();
  }

  getQueueStatistics(): QueueStatistics {
    const pendingTasks = this.taskQueue.length;
    const runningTasks = this.runningTasks.size;
    const totalTasks = this.statistics.totalTasks;
    const completedTasks = this.statistics.completedTasks;
    const failedTasks = this.statistics.failedTasks;
    const cancelledTasks = this.statistics.cancelledTasks;
    const totalExecutionTime = this.statistics.totalExecutionTime;

    const finishedTasks = completedTasks + failedTasks + cancelledTasks;
    const successRate = finishedTasks > 0 ? completedTasks / finishedTasks : 0;
    const averageExecutionTime = completedTasks > 0 ? totalExecutionTime / completedTasks : 0;

    return {
      totalTasks,
      pendingTasks,
      runningTasks,
      completedTasks,
      failedTasks,
      cancelledTasks,
      averageExecutionTime,
      successRate,
    };
  }

  setMaxConcurrentTasks(maxTasks: number): void {
    this.maxConcurrentTasks = Math.max(1, maxTasks);
    this.processQueue();
  }

  clearQueue(): void {
    for (const task of this.taskQueue) {
      task.status = TaskStatus.CANCELLED;
      if (task.onCancel) {
        task.onCancel();
      }
    }
    this.taskQueue = [];
    this.emit("queueCleared");
  }

  private async executeTask(task: BackgroundTask): Promise<void> {
    task.status = TaskStatus.RUNNING;
    task.startedAt = Date.now();
    this.emit("taskStarted", task);

    try {
      const result = await task.execute();
      task.result = result;
      task.status = TaskStatus.COMPLETED;
      task.completedAt = Date.now();

      const executionTime = task.completedAt - task.startedAt!;
      this.statistics.totalExecutionTime += executionTime;
      this.statistics.completedTasks++;

      this.emit("taskCompleted", task);
    } catch (error) {
      task.error = error as Error;
      task.retryCount++;

      if (task.retryCount <= task.maxRetries) {
        task.status = TaskStatus.PENDING;
        this.taskQueue.push(task);
        this.taskQueue.sort((a, b) => b.priority - a.priority);

        setTimeout(
          () => {
            this.processQueue();
          },
          task.retryDelay * Math.pow(2, task.retryCount - 1),
        );

        this.emit("taskRetryScheduled", task);
      } else {
        task.status = TaskStatus.FAILED;
        task.completedAt = Date.now();
        this.statistics.failedTasks++;

        this.emit("taskFailed", task);
      }
    } finally {
      this.runningTasks.delete(task.id);
      this.processQueue();
    }
  }

  private findTask(taskId: string): BackgroundTask | null {
    const queuedTask = this.taskQueue.find((task) => task.id === taskId);
    if (queuedTask) return queuedTask;

    const runningTask = this.runningTasks.get(taskId);
    if (runningTask) return runningTask;

    return null;
  }

  private generateTaskId(): string {
    return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
