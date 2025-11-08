import React from "react";
import { Instagram } from "lucide-react";

const sizeMap = {
  sm: {
    outer: "w-[2.745rem] h-[2.745rem]",
    icon: "w-[1.22rem] h-[1.22rem]",
  },
  md: {
    outer: "w-[3.355rem] h-[3.355rem]",
    icon: "w-[1.525rem] h-[1.525rem]",
  },
  lg: {
    outer: "w-[3.965rem] h-[3.965rem]",
    icon: "w-[1.83rem] h-[1.83rem]",
  },
};

export default function InstagramAppIcon({ size = "md", className = "" }) {
  const sizes = sizeMap[size] || sizeMap.md;

  return (
    <div
      className={`rounded-[1.9rem] bg-gradient-to-br from-[#FFE5DC] via-[#FFEEE8] to-[#FFF5F2] shadow-sm flex items-center justify-center ${sizes.outer} ${className}`}
    >
      <Instagram className={`${sizes.icon} text-[#FF6B4A]`} />
    </div>
  );
}