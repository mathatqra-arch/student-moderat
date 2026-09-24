import React from "react";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  variant?: "glass" | "solid" | "bordered";
  hoverable?: boolean;
}

export function Card({
  children,
  variant = "glass",
  hoverable = true,
  className = "",
  ...props
}: CardProps) {
  const baseStyles = "rounded-2xl p-4 transition duration-200";
  
  const variantStyles = {
    glass: "glass-card border border-gray-800/80 bg-gray-900/60 backdrop-blur-md",
    solid: "bg-gray-900 border border-gray-800",
    bordered: "bg-transparent border border-gray-800 hover:border-blue-500/30",
  };

  const hoverStyles = hoverable ? "hover:border-blue-500/40 hover:-translate-y-0.5" : "";

  return (
    <div className={`${baseStyles} ${variantStyles[variant]} ${hoverStyles} ${className}`} {...props}>
      {children}
    </div>
  );
}
