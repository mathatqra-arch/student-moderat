import React from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "success" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
}

export function Button({
  children,
  variant = "primary",
  size = "md",
  isLoading = false,
  className = "",
  disabled,
  ...props
}: ButtonProps) {
  const baseStyles =
    "inline-flex items-center justify-center font-semibold rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed";

  const sizeStyles = {
    sm: "px-3 py-1.5 text-xs gap-1.5",
    md: "px-4 py-2.5 text-sm gap-2",
    lg: "px-6 py-3.5 text-base gap-2.5",
  };

  const variantStyles = {
    primary: "bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/20 active:scale-[0.98]",
    secondary: "bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 active:scale-[0.98]",
    success: "bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20 active:scale-[0.98]",
    danger: "bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/20 active:scale-[0.98]",
    ghost: "bg-transparent hover:bg-gray-800/60 text-gray-400 hover:text-gray-100",
  };

  return (
    <button
      className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <span className="flex items-center gap-2">
          <svg className="animate-spin h-4 w-4 text-current" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span>جاري التحميل...</span>
        </span>
      ) : (
        children
      )}
    </button>
  );
}
