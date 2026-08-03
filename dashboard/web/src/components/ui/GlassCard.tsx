import React from "react";

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  hoverable?: boolean;
}

export function GlassCard({ children, className = "", hoverable = true, ...props }: GlassCardProps) {
  return (
    <div
      className={`glass-panel rounded-2xl p-5 border border-white/10 ${
        hoverable ? "glass-panel-hover" : ""
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
