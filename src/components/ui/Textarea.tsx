import React from "react";

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export function Textarea({
  label,
  error,
  className = "",
  rows = 4,
  ...props
}: TextareaProps) {
  return (
    <div className="space-y-1 w-full">
      {label && <label className="text-xs font-medium text-gray-300">{label}</label>}
      <textarea
        rows={rows}
        className={`w-full bg-gray-900/90 border border-gray-800 rounded-xl p-3.5 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition resize-none ${
          error ? "border-rose-500" : ""
        } ${className}`}
        {...props}
      />
      {error && <p className="text-xs text-rose-400 mt-1">{error}</p>}
    </div>
  );
}
