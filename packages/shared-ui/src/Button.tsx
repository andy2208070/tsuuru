import type { ButtonHTMLAttributes } from "react";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary";
};

const variantClasses = {
  primary: "bg-indigo-600 text-white hover:bg-indigo-500 focus-visible:outline-indigo-600",
  secondary: "bg-white text-slate-800 ring-1 ring-slate-300 hover:bg-slate-50 focus-visible:outline-slate-500",
};

export function Button({
  className = "",
  variant = "primary",
  ...props
}: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold shadow-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${variantClasses[variant]} ${className}`}
      {...props}
    />
  );
}