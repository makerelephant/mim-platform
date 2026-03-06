"use client";

import { useState } from "react";

interface AvatarProps {
  src: string | null | undefined;
  name: string;
  size?: "sm" | "md" | "lg";
  shape?: "circle" | "square";
  className?: string;
}

const sizeClasses = {
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-16 w-16 text-lg",
};

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function getColor(name: string): string {
  const colors = [
    "bg-blue-500", "bg-green-500", "bg-purple-500", "bg-orange-500",
    "bg-pink-500", "bg-teal-500", "bg-indigo-500", "bg-rose-500",
    "bg-cyan-500", "bg-amber-500",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

export function Avatar({ src, name, size = "sm", shape = "circle", className = "" }: AvatarProps) {
  const [imgError, setImgError] = useState(false);
  const sizeClass = sizeClasses[size];
  const roundedClass = shape === "square" ? "rounded-[6px]" : "rounded-full";

  if (src && !imgError) {
    return (
      <div className={`${sizeClass} ${roundedClass} overflow-hidden shrink-0 ${className}`}>
        <img
          src={src}
          alt={name}
          onError={() => setImgError(true)}
          className="w-full h-full object-cover"
        />
      </div>
    );
  }

  return (
    <div className={`${sizeClass} ${getColor(name)} ${roundedClass} flex items-center justify-center text-white font-medium shrink-0 ${className}`}>
      {getInitials(name)}
    </div>
  );
}
