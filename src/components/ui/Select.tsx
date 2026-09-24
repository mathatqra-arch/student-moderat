import React from "react";

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}

export function Select({
  label,
  icon,
  children,
  className = "",
  ...props
}: SelectProps) {
  return (
    <div className="space-y-1 w-full">
      {label && (
        <label className="text-xs font-medium text-gray-300 flex items-center gap-1.5">
          {icon}
          {label}
        </label>
      )}
      <select
        className={`w-full bg-gray-900 border border-gray-800 rounded-xl px-3.5 py-2.5 text-sm text-gray-100 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition ${className}`}
        {...props}
      >
        {children}
      </select>
    </div>
  );
}
