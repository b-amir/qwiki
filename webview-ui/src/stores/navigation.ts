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

// Navigation state interface
interface NavigationState {
  currentPage: PageType;
  targetPage: PageType | null;
  state: NavigationMachineState;
  direction: NavigationDirection | null;
  validationError: ValidationError | null;
  guard: NavigationGuard | null;
}

export const useNavigationStore = defineStore("navigation", {
  state: (): NavigationState => ({
    currentPage: "wiki",
    targetPage: null,
    state: "idle",
    direction: null,
    validationError: null,
    guard: null,
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

      // If already on the page, do nothing
      if (this.currentPage === page) {
        logger.debug("Already on target page, skipping navigation");
        return true;
      }

      // If already navigating, reject
      if (this.state !== "idle") {
        logger.warn("Navigation already in progress", { currentState: this.state });
        return false;
      }

      // Clear previous validation error
      this.validationError = null;

      // Set target and direction
      this.targetPage = page;
      this.direction = isBack ? "back" : "forward";

      // If guard exists, transition to validating
      if (this.guard) {
        logger.debug("Guard exists, transitioning to validating state");
        this._transitionTo("validating");

        try {
          const result = await this.guard(page, this.direction);
          logger.debug("Guard validation completed", { allowed: result.allowed });

          if (!result.allowed) {
            // Validation failed, transition to blocked
            this._blockNavigation(
              result.error || {
                message: "Navigation blocked",
                code: "VALIDATION_FAILED",
              },
            );
            return false;
          }
        } catch (error) {
          logger.error("Guard execution error", error);
          this._blockNavigation({
            message: "Navigation validation error",
            code: "GUARD_ERROR",
          });
          return false;
        }
      }

      // Validation passed or no guard, proceed with navigation
      this._completeNavigation();
      return true;
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

      // Update current page immediately
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
    },

    // Clear validation error manually
    clearValidationError(): void {
      this.validationError = null;
    },
  },
});
