<template>
  <svg
    class="spinner"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    focusable="false"
  >
    <defs>
      <linearGradient id="starGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color: #8b5cf6">
          <animate
            attributeName="stop-color"
            values="#8B5CF6;#3B82F6;#8B5CF6"
            dur="6s"
            repeatCount="indefinite"
          />
        </stop>
        <stop offset="100%" style="stop-color: #3b82f6">
          <animate
            attributeName="stop-color"
            values="#3B82F6;#8B5CF6;#3B82F6"
            dur="2s"
            repeatCount="indefinite"
          />
        </stop>
      </linearGradient>
    </defs>
    <rect x="1" y="1" rx="1" width="10" height="10">
      <animate
        id="spinner_FFyM"
        begin="0;spinner_HDCY.end"
        attributeName="x"
        dur="0.2s"
        values="1;13"
        fill="freeze"
      />
      <animate
        id="spinner_AIvE"
        begin="spinner_1FwE.end"
        attributeName="y"
        dur="0.2s"
        values="1;13"
        fill="freeze"
      />
      <animate
        id="spinner_wWCL"
        begin="spinner_gH4o.end"
        attributeName="x"
        dur="0.2s"
        values="13;1"
        fill="freeze"
      />
      <animate
        id="spinner_S3Gg"
        begin="spinner_Q0bx.end"
        attributeName="y"
        dur="0.2s"
        values="13;1"
        fill="freeze"
      />
    </rect>
    <rect x="1" y="13" rx="1" width="10" height="10">
      <animate
        id="spinner_1FwE"
        begin="spinner_FFyM.end"
        attributeName="y"
        dur="0.2s"
        values="13;1"
        fill="freeze"
      />
      <animate
        id="spinner_gH4o"
        begin="spinner_AIvE.end"
        attributeName="x"
        dur="0.2s"
        values="1;13"
        fill="freeze"
      />
      <animate
        id="spinner_Q0bx"
        begin="spinner_wWCL.end"
        attributeName="y"
        dur="0.2s"
        values="1;13"
        fill="freeze"
      />
      <animate
        id="spinner_HDCY"
        begin="spinner_S3Gg.end"
        attributeName="x"
        dur="0.2s"
        values="13;1"
        fill="freeze"
      />
    </rect>
  </svg>
</template>

<style scoped>
.spinner {
  width: clamp(16px, 4vw, 20px);
  height: clamp(16px, 4vw, 20px);
  flex-shrink: 0;
}

.spinner rect {
  fill: url(#starGradient);
}
</style>
