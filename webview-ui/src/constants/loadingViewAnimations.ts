export const LoadingViewAnimations = {
  minStepDuration: 100,
  maxLagSteps: 2,
  fastCatchUpDelay: 30,
  moderateCatchUpDelay: 60,
  blurMultiplier: 0.4,
  opacityReductionMultiplier: 0.2,
  maxBlurAmount: 2,
  minOpacity: 0.3,
  connectorOpacity: 0.07,
  dropShadowFull: "drop-shadow(0 0 10px rgba(139, 92, 246, 0.5))",
  dropShadowCompact: "drop-shadow(0 0 8px rgba(139, 92, 246, 0.4))",
} as const;
