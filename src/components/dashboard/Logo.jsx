import React from "react";
import logoIcon from "@/assets/Group 113 (3) 3.png";

export default function Logo({ size = "small", className = "", hideText = false, text = "In'Stalker" }) {
  const sizeClasses = {
    small: "h-6",
    normal: "h-8",
    large: "h-10"
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <img 
        src={logoIcon}
        alt={text}
        className={`${sizeClasses[size]} rounded-lg`}
      />
      {!hideText && (
        <span 
          style={{
            color: '#000',
            fontFamily: 'Montserrat, sans-serif',
            fontSize: '23px',
            fontStyle: 'normal',
            fontWeight: 700,
            lineHeight: '8px',
            letterSpacing: '-0.8px'
          }}
        >
          {text}
        </span>
      )}
    </div>
  );
}