import type { ButtonHTMLAttributes, ReactNode } from "react";

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "ghost";
}) {
  const variants = {
    primary: "bg-indigo-700 text-white hover:bg-indigo-800",
    secondary: "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
    danger: "bg-red-700 text-white hover:bg-red-800",
    ghost: "text-slate-600 hover:bg-slate-100",
  };
  return (
    <button
      {...props}
      className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold shadow-sm transition disabled:opacity-55 ${variants[variant]} ${className}`}
    />
  );
}

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-heading flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function Notice({
  children,
  kind = "info",
  role = "status",
}: {
  children: ReactNode;
  kind?: "info" | "success" | "error";
  role?: "status" | "alert";
}) {
  return <p className={`notice notice-${kind}`} role={role}>{children}</p>;
}

export function EmptyState({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <p className="font-semibold text-slate-700">{title}</p>
      {children && <div className="mt-2 text-sm">{children}</div>}
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase().replaceAll("_", "-");
  return (
    <span className={`status-badge status-${normalized}`}>
      {status.replaceAll("_", " ")}
    </span>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`animate-pulse rounded-lg bg-slate-100 ${className}`} />;
}
