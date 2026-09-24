import React from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  icon?: React.ReactNode;
  error?: string;
}

export function Input({
  label,
  icon,
  error,
  className = "",
  ...props
}: InputProps) {
  return (
    <div className="space-y-1 w-full">
      {label && (
        <label className="text-xs font-medium text-gray-300 flex items-center gap-1.5">
          {icon}
          {label}
        </label>
      )}
      <input
        className={`w-full bg-gray-900/90 border border-gray-800 rounded-xl px-3.5 py-2.5 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition ${
          error ? "border-rose-500" : ""
        } ${className}`}
        {...props}
      />
      {error && <p className="text-xs text-rose-400 mt-1">{error}</p>}
    </div>
  );
}
