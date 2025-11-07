import { defineStore } from "pinia";
import { createLogger } from "@/utilities/logging";

const logger = createLogger("NavigationStore");

// Page types
export type PageType =
  | "wiki"
  | "settings"
  | "errorHistory"
  | "savedWikis"
  | "promptManager"
  | "qualityDashboard"
  | "wikiAggregator";

// Navigation state machine states
export type NavigationMachineState = "idle" | "validating" | "navigating" | "blocked";

// Navigation direction
export type NavigationDirection = "forward" | "back";

// Validation error structure
export interface ValidationError {
  message: string;
  code: string;
  suggestions?: string[];
}

// Validation result from guards
export interface ValidationResult {
  allowed: boolean;
  error?: ValidationError;
}

// Navigation guard function type
export type NavigationGuard = (
  target: PageType,
  direction: NavigationDirection,
) => Promise<ValidationResult>;

type PendingNavigation = {
  page: PageType;
  isBack: boolean;
  resolve: (value: boolean) => void;
};

// Navigation state interface
interface NavigationState {
  currentPage: PageType;
  targetPage: PageType | null;
  sourcePage: PageType | null; // Track where we're navigating FROM for guard validation
  state: NavigationMachineState;
  direction: NavigationDirection | null;
  validationError: ValidationError | null;
  guard: NavigationGuard | null;
  pendingQueue: PendingNavigation[];
}

export const useNavigationStore = defineStore("navigation", {
  state: (): NavigationState => ({
    currentPage: "wiki",
    targetPage: null,
    sourcePage: null,
    state: "idle",
    direction: null,
    validationError: null,
    guard: null,
    pendingQueue: [],
  }),

  getters: {
    // Is navigation in progress?
    isNavigating(state): boolean {
      return state.state === "navigating";
    },

    // Is currently validating?
    isValidating(state): boolean {
      return state.state === "validating";
    },

    // Is navigation blocked?
    isBlocked(state): boolean {
      return state.state === "blocked";
    },

    // Get current validation error
    currentError(state): ValidationError | null {
      return state.validationError;
    },
  },

  actions: {
    // Check if navigating to specific page
    isNavigatingTo(page: PageType): boolean {
      return this.state === "navigating" && this.targetPage === page;
    },

    // Register navigation guard
    setGuard(guard: NavigationGuard | null): void {
      logger.debug("Setting navigation guard", { hasGuard: !!guard });
      this.guard = guard;
    },

    // Initiate navigation
    async navigateTo(page: PageType, isBack: boolean = false): Promise<boolean> {
      logger.debug("navigateTo called", {
        page,
        isBack,
        currentPage: this.currentPage,
        currentState: this.state,
      });

      // If already on the page and idle, do nothing
      if (this.currentPage === page && this.state === "idle") {
        logger.debug("Already on target page, skipping navigation");
        return true;
      }

      // If already navigating, queue the request
      if (this.state !== "idle") {
        logger.info("Navigation busy, queueing request", {
          currentState: this.state,
          page,
        });
        return await new Promise<boolean>((resolve) => {
          this.pendingQueue.push({ page, isBack, resolve });
        });
      }

      // Store source page for guard validation
      const sourcePage = this.currentPage;
      this.sourcePage = sourcePage;

      // Special case: leaving settings requires blocking validation
      // Don't update currentPage optimistically, show skeleton on settings page
      const isLeavingSettings = sourcePage === "settings" && page !== "settings";

      if (isLeavingSettings) {
        // BLOCKING: Stay on settings, show loading skeleton, validate first
        this.targetPage = page;
        this.direction = isBack ? "back" : "forward";

        const result = await this._beginNavigation(page, isBack);

        if (!result) {
          // Validation failed, clear target and stay on settings
          logger.warn("Settings validation failed, staying on settings", {
            attemptedTarget: page,
          });
          this.targetPage = null;
          this.direction = null;
        }
        // If validation passed, currentPage was updated by _completeNavigation

        this.sourcePage = null;
        return result;
      } else {
        // OPTIMISTIC: Change page immediately for instant UI feedback
        this.currentPage = page;
        this.targetPage = page;
        this.direction = isBack ? "back" : "forward";

        const result = await this._beginNavigation(page, isBack);

        // If validation failed, revert to source page
        if (!result) {
          logger.warn("Navigation validation failed, reverting", {
            from: sourcePage,
            attemptedTarget: page,
          });
          this.currentPage = sourcePage;
          this.targetPage = null;
          this.direction = null;
        }

        this.sourcePage = null;
        return result;
      }
    },

    // Handle backend navigation messages
    handleNavigationMessage(page: PageType, isBack: boolean): void {
      logger.info("Backend navigation message received", { page, isBack });

      // Backend navigation bypasses guards for now
      // This maintains backward compatibility
      if (this.currentPage !== page) {
        this.targetPage = page;
        this.direction = isBack ? "back" : "forward";
        this._transitionTo("navigating");
        this._completeNavigation();
      }
    },

    // Internal: Transition to a new state
    _transitionTo(newState: NavigationMachineState): void {
      const oldState = this.state;

      // Validate state transitions
      const validTransitions: Record<NavigationMachineState, NavigationMachineState[]> = {
        idle: ["validating", "navigating"],
        validating: ["navigating", "blocked"],
        navigating: ["idle"],
        blocked: ["idle"],
      };

      if (!validTransitions[oldState].includes(newState)) {
        logger.error("Invalid state transition", { from: oldState, to: newState });
        return;
      }

      logger.debug("State transition", { from: oldState, to: newState });
      this.state = newState;
    },

    // Internal: Complete navigation
    _completeNavigation(): void {
      logger.debug("Completing navigation", {
        from: this.currentPage,
        to: this.targetPage,
      });

      if (!this.targetPage) {
        logger.error("Cannot complete navigation without target page");
        this._resetToIdle();
        return;
      }

      // Transition to navigating state
      this._transitionTo("navigating");

      // Update current page after validation passed
      this.currentPage = this.targetPage;

      // Reset to idle
      this._resetToIdle();
    },

    // Internal: Block navigation with error
    _blockNavigation(error: ValidationError): void {
      logger.debug("Blocking navigation", { error });

      this._transitionTo("blocked");
      this.validationError = error;

      // Auto-reset to idle after a short delay to allow error display
      setTimeout(() => {
        if (this.state === "blocked") {
          this._resetToIdle();
        }
      }, 100);
    },

    // Internal: Reset to idle state
    _resetToIdle(): void {
      logger.debug("Resetting to idle state");

      this.targetPage = null;
      this.direction = null;
      this.state = "idle";
      // Note: validationError is NOT cleared here so it can be displayed
      this._processPendingQueue();
    },

    // Clear validation error manually
    clearValidationError(): void {
      this.validationError = null;
    },

    async _beginNavigation(page: PageType, isBack: boolean): Promise<boolean> {
      // Clear previous validation error
      this.validationError = null;

      // Set target and direction (may already be set by optimistic update)
      this.targetPage = page;
      this.direction = isBack ? "back" : "forward";

      const { useErrorStore } = await import("./error");
      const errorStore = useErrorStore();
      errorStore.onNavigationStart(page);

      if (this.guard) {
        logger.debug("Guard exists, transitioning to validating state");
        this._transitionTo("validating");

        try {
          const result = await this.guard(page, this.direction);
          logger.debug("Guard validation completed", { allowed: result.allowed });

          if (!result.allowed) {
            this._blockNavigation(
              result.error || {
                message: "Navigation blocked",
                code: "VALIDATION_FAILED",
              },
            );
            errorStore.onNavigationComplete(page);
            return false;
          }
        } catch (error) {
          logger.error("Guard execution error", error);
          this._blockNavigation({
            message: "Navigation validation error",
            code: "GUARD_ERROR",
          });
          errorStore.onNavigationComplete(page);
          return false;
        }
      }

      this._completeNavigation();
      errorStore.onNavigationComplete(page);
      return true;
    },

    _processPendingQueue(): void {
      if (this.state !== "idle") {
        return;
      }
      const next = this.pendingQueue.shift();
      if (!next) {
        return;
      }
      logger.debug("Processing queued navigation", { page: next.page });
      this._beginNavigation(next.page, next.isBack)
        .then((result) => {
          next.resolve(result);
        })
        .catch((error) => {
          logger.error("Queued navigation error", error);
          next.resolve(false);
        });
    },
  },
});
