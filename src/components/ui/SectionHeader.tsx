import React from "react";

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}

export function SectionHeader({
  title,
  subtitle,
  icon,
  action,
}: SectionHeaderProps) {
  return (
    <div className="flex items-center justify-between gap-3 bg-gray-900/60 p-4 rounded-2xl border border-gray-800">
      <div className="flex items-center gap-3">
        {icon && (
          <div className="p-2.5 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30">
            {icon}
          </div>
        )}
        <div>
          <h2 className="text-base font-bold text-gray-100">{title}</h2>
          {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}
