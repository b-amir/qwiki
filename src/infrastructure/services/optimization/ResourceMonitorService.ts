import { EventEmitter } from "events";
import { MemoryOptimizationService, type MemoryUsage } from "./MemoryOptimizationService";
import {
  LoggingService,
  createLogger,
  type Logger,
} from "@/infrastructure/services/logging/LoggingService";

export interface CpuUsage {
  user: number;
  system: number;
  total: number;
  percentage: number;
}

export interface ResourceUsage {
  memory: MemoryUsage;
  cpu: CpuUsage;
  timestamp: number;
}

export interface ResourceThresholds {
  memoryPercentage: number;
  cpuPercentage: number;
  checkInterval: number;
}

export interface ThrottleConfig {
  enabled: boolean;
  memoryThreshold: number;
  cpuThreshold: number;
  throttleDelay: number;
}

export class ResourceMonitorService extends EventEmitter {
  private monitoringInterval: NodeJS.Timeout | null = null;
  private cpuUsageHistory: CpuUsage[] = [];
  private resourceHistory: ResourceUsage[] = [];
  private isThrottled = false;
  private throttleTimer: NodeJS.Timeout | null = null;
  private logger: Logger;
  private thresholds: ResourceThresholds = {
    memoryPercentage: 80,
    cpuPercentage: 80,
    checkInterval: 5000,
  };
  private throttleConfig: ThrottleConfig = {
    enabled: true,
    memoryThreshold: 85,
    cpuThreshold: 85,
    throttleDelay: 1000,
  };
  private previousCpuUsage: NodeJS.CpuUsage | null = null;
  private previousCpuTime: number = 0;

  constructor(
    private memoryOptimizationService: MemoryOptimizationService,
    private loggingService: LoggingService,
  ) {
    super();
    this.logger = createLogger("ResourceMonitorService");
  }

  startMonitoring(interval: number = this.thresholds.checkInterval): void {
    if (this.monitoringInterval) {
      this.stopMonitoring();
    }

    this.logger.info("Starting resource monitoring", { interval });
    this.monitoringInterval = setInterval(() => {
      this.checkResources();
    }, interval);

    this.emit("monitoringStarted", { interval });
  }

  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      this.logger.info("Resource monitoring stopped");
      this.emit("monitoringStopped");
    }
  }

  private checkResources(): void {
    const memory = this.memoryOptimizationService.getMemoryUsage();
    const cpu = this.getCpuUsage();
    const resourceUsage: ResourceUsage = {
      memory,
      cpu,
      timestamp: Date.now(),
    };

    this.resourceHistory.push(resourceUsage);
    if (this.resourceHistory.length > 100) {
      this.resourceHistory.shift();
    }

    this.cpuUsageHistory.push(cpu);
    if (this.cpuUsageHistory.length > 100) {
      this.cpuUsageHistory.shift();
    }

    this.emit("resourceChecked", resourceUsage);

    if (this.shouldThrottle(memory, cpu)) {
      this.enableThrottling();
    } else {
      this.disableThrottling();
    }

    if (memory.percentageUsed > this.thresholds.memoryPercentage) {
      this.logger.warn("High memory usage detected", {
        percentage: memory.percentageUsed,
        heapUsed: memory.heapUsed,
      });
      this.emit("highMemoryUsage", memory);
    }

    if (cpu.percentage > this.thresholds.cpuPercentage) {
      this.logger.warn("High CPU usage detected", {
        percentage: cpu.percentage,
        total: cpu.total,
      });
      this.emit("highCpuUsage", cpu);
    }
  }

  private getCpuUsage(): CpuUsage {
    const currentUsage = process.cpuUsage();
    const currentTime = Date.now();

    if (!this.previousCpuUsage || this.previousCpuTime === 0) {
      this.previousCpuUsage = currentUsage;
      this.previousCpuTime = currentTime;
      return {
        user: 0,
        system: 0,
        total: 0,
        percentage: 0,
      };
    }

    const timeDelta = (currentTime - this.previousCpuTime) * 1000;
    const userDelta = currentUsage.user - this.previousCpuUsage.user;
    const systemDelta = currentUsage.system - this.previousCpuUsage.system;
    const totalDelta = userDelta + systemDelta;

    const percentage = timeDelta > 0 ? (totalDelta / timeDelta) * 100 : 0;

    this.previousCpuUsage = currentUsage;
    this.previousCpuTime = currentTime;

    return {
      user: userDelta / 1000,
      system: systemDelta / 1000,
      total: totalDelta / 1000,
      percentage: Math.min(percentage, 100),
    };
  }

  private shouldThrottle(memory: MemoryUsage, cpu: CpuUsage): boolean {
    if (!this.throttleConfig.enabled) {
      return false;
    }

    return (
      memory.percentageUsed > this.throttleConfig.memoryThreshold ||
      cpu.percentage > this.throttleConfig.cpuThreshold
    );
  }

  private enableThrottling(): void {
    if (this.isThrottled) {
      return;
    }

    this.isThrottled = true;
    this.logger.warn("Resource throttling enabled", {
      memoryThreshold: this.throttleConfig.memoryThreshold,
      cpuThreshold: this.throttleConfig.cpuThreshold,
    });
    this.emit("throttlingEnabled");
  }

  private disableThrottling(): void {
    if (!this.isThrottled) {
      return;
    }

    if (this.throttleTimer) {
      clearTimeout(this.throttleTimer);
      this.throttleTimer = null;
    }

    this.throttleTimer = setTimeout(() => {
      this.isThrottled = false;
      this.logger.info("Resource throttling disabled");
      this.emit("throttlingDisabled");
    }, this.throttleConfig.throttleDelay);
  }

  async throttleIfNeeded<T>(operation: () => Promise<T>): Promise<T> {
    if (this.isThrottled) {
      this.logger.debug("Operation throttled due to resource constraints");
      await this.delay(this.throttleConfig.throttleDelay);
    }

    return operation();
  }

  getCurrentUsage(): ResourceUsage | null {
    if (this.resourceHistory.length === 0) {
      return null;
    }

    return this.resourceHistory[this.resourceHistory.length - 1];
  }

  getAverageCpuUsage(windowSize: number = 10): number {
    if (this.cpuUsageHistory.length === 0) {
      return 0;
    }

    const recent = this.cpuUsageHistory.slice(-windowSize);
    const sum = recent.reduce((acc, usage) => acc + usage.percentage, 0);
    return sum / recent.length;
  }

  getAverageMemoryUsage(windowSize: number = 10): number {
    if (this.resourceHistory.length === 0) {
      return 0;
    }

    const recent = this.resourceHistory.slice(-windowSize);
    const sum = recent.reduce((acc, usage) => acc + usage.memory.percentageUsed, 0);
    return sum / recent.length;
  }

  setThresholds(thresholds: Partial<ResourceThresholds>): void {
    this.thresholds = { ...this.thresholds, ...thresholds };
    this.logger.info("Resource thresholds updated", this.thresholds);
    this.emit("thresholdsUpdated", this.thresholds);
  }

  setThrottleConfig(config: Partial<ThrottleConfig>): void {
    this.throttleConfig = { ...this.throttleConfig, ...config };
    this.logger.info("Throttle config updated", this.throttleConfig);
    this.emit("throttleConfigUpdated", this.throttleConfig);
  }

  isThrottlingActive(): boolean {
    return this.isThrottled;
  }

  getResourceHistory(): ResourceUsage[] {
    return [...this.resourceHistory];
  }

  clearHistory(): void {
    this.resourceHistory = [];
    this.cpuUsageHistory = [];
    this.logger.debug("Resource history cleared");
    this.emit("historyCleared");
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  dispose(): void {
    this.stopMonitoring();
    if (this.throttleTimer) {
      clearTimeout(this.throttleTimer);
      this.throttleTimer = null;
    }
    this.clearHistory();
    this.removeAllListeners();
  }
}
