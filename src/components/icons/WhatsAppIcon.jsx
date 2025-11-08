import React from "react";

export default function WhatsAppIcon({
  size = 48,
  className = "",
  color = "#1FBE6B",
  backgroundColor = "#F0F7ED"
}) {
  const toPx = (value) => (typeof value === "number" ? `${Math.round(value)}px` : value);
  const outerSize = toPx(size);
  const glyphSize = toPx(typeof size === "number" ? size * 0.62 : size);

  return (
    <div
      className={`flex items-center justify-center rounded-[18px] ${className}`}
      style={{
        width: outerSize,
        height: outerSize,
        backgroundColor,
      }}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 256 256"
        aria-hidden="true"
        style={{ width: glyphSize, height: glyphSize }}
      >
        <path
          d="M128 32c-53.02 0-96 41.08-96 91.73 0 16.45 5.08 32.35 14.7 46.17L32 224l55.47-13.83c12.7 6.52 26.97 10 40.53 10 53.02 0 96-41.08 96-91.72C224 73.08 181.02 32 128 32z"
          fill="none"
          stroke={color}
          strokeWidth="14"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M176.68 150.24c-2.37-1.19-14.02-6.88-16.19-7.66-2.17-.78-3.76-1.19-5.35 1.19-1.6 2.38-6.13 7.66-7.5 9.25-1.38 1.58-2.76 1.78-5.12.59-2.37-1.19-10-3.64-19.04-11.6-7.06-6.23-11.83-13.92-13.2-16.3-1.37-2.38-.15-3.66 1.03-4.85 1.06-1.05 2.37-2.76 3.55-4.14 1.18-1.39 1.58-2.38 2.37-3.97.79-1.58.4-2.98-.2-4.17-.59-1.19-5.35-12.88-7.33-17.64-1.93-4.63-3.9-4-5.35-4.08-1.38-.08-2.97-.1-4.56-.1-1.59 0-4.17.6-6.36 2.99-2.17 2.38-8.32 8.12-8.32 19.78s8.52 22.96 9.7 24.55c1.18 1.58 16.76 26.26 40.67 36.11 5.68 2.45 10.11 3.91 13.56 5 5.7 1.81 10.9 1.55 14.99.94 4.57-.68 14.02-5.73 15.98-11.27 1.97-5.53 1.97-10.26 1.38-11.27-.59-1.01-2.15-1.58-4.52-2.79z"
          fill={color}
        />
      </svg>
    </div>
  );
}