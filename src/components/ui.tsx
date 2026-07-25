"use client";

import { useState } from "react";

export function CopyButton({
  text,
  label = "コピー",
}: {
  text: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          /* noop */
        }
      }}
      className="text-xs px-3 py-1 rounded-full bg-neutral-100 hover:bg-neutral-200 text-neutral-700 transition-colors"
    >
      {copied ? "✓ コピー済み" : label}
    </button>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm text-neutral-500">
      <span className="inline-block w-4 h-4 border-2 border-neutral-300 border-t-neutral-700 rounded-full animate-spin" />
      {label}
    </span>
  );
}

export function ErrorBox({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">
      {message}
    </div>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl bg-white border border-neutral-200 shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}

export function EmptyState({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-neutral-300 bg-white/60 px-6 py-12 text-center">
      <p className="text-sm font-medium text-neutral-600">{title}</p>
      {description && (
        <p className="mt-1 max-w-sm text-sm text-neutral-400">{description}</p>
      )}
    </div>
  );
}

export function PageHeader({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="mb-4">
      <h1 className="text-xl font-bold">{title}</h1>
      {description && (
        <p className="text-sm text-neutral-500 mt-1">{description}</p>
      )}
    </div>
  );
}

/** 選択式のカード（撮影プランナーで商品・木材・背景素材を選ぶ）。 */
export function SelectableCard({
  name,
  subtitle,
  selected,
  badge,
  onClick,
}: {
  name: string;
  subtitle?: string | null;
  selected: boolean;
  badge?: string | null;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex min-h-16 flex-col justify-center rounded-xl border bg-white px-3 py-2.5 text-left transition-colors ${
        selected
          ? "border-neutral-900 ring-2 ring-neutral-200"
          : "border-neutral-200 hover:border-neutral-400"
      }`}
    >
      {selected && (
        <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-neutral-900 text-[10px] text-white">
          {badge ?? "✓"}
        </span>
      )}
      <p className="pr-5 text-sm font-medium leading-snug break-words">{name}</p>
      {subtitle && (
        <p className="mt-0.5 text-xs text-neutral-400 break-words">{subtitle}</p>
      )}
    </button>
  );
}

export function Button({
  children,
  variant = "primary",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
}) {
  const styles = {
    primary: "bg-neutral-900 text-white hover:bg-neutral-700",
    secondary: "bg-white border border-neutral-300 text-neutral-800 hover:bg-neutral-50",
    ghost: "text-neutral-600 hover:bg-neutral-100",
    danger: "bg-red-50 text-red-600 hover:bg-red-100 border border-red-200",
  }[variant];
  return (
    <button
      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${styles} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
