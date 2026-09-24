import React from "react";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "rose" | "blue" | "amber" | "emerald" | "purple" | "gray";
  size?: "sm" | "md";
  className?: string;
}

export function Badge({
  children,
  variant = "blue",
  size = "sm",
  className = "",
}: BadgeProps) {
  const sizeStyles = {
    sm: "px-2.5 py-0.5 text-[11px] font-semibold",
    md: "px-3 py-1 text-xs font-bold",
  };

  const variantStyles = {
    rose: "bg-rose-500/10 text-rose-400 border border-rose-500/30",
    blue: "bg-blue-500/10 text-blue-400 border border-blue-500/30",
    amber: "bg-amber-500/10 text-amber-400 border border-amber-500/30",
    emerald: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30",
    purple: "bg-purple-500/10 text-purple-400 border border-purple-500/30",
    gray: "bg-gray-800 text-gray-400 border border-gray-700",
  };

  return (
    <span className={`inline-flex items-center gap-1 rounded-full whitespace-nowrap ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}>
      {children}
    </span>
  );
}
