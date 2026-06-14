import type { ButtonHTMLAttributes } from "react";

type ButtonVariant = "primary" | "danger" | "ghost";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
};

const variantClass: Record<ButtonVariant, string> = {
  primary: "bg-blue-600 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white shadow-[0_0_12px_rgba(59,130,246,0.3)] hover:shadow-[0_0_20px_rgba(59,130,246,0.5)] transition-all duration-200",
  danger: "bg-red-600 bg-gradient-to-r from-red-600 to-rose-500 hover:from-red-500 hover:to-rose-400 text-white shadow-[0_0_12px_rgba(239,68,68,0.3)] hover:shadow-[0_0_20px_rgba(239,68,68,0.5)] transition-all duration-200",
  ghost: "bg-transparent text-gray-200 border border-cyan-500/30 hover:border-cyan-400/60 bg-slate-900/40 hover:bg-slate-800/80 shadow-sm hover:shadow-[0_0_10px_rgba(6,182,212,0.15)] transition-all duration-200",
};

function Button({ variant = "primary", className = "", ...props }: ButtonProps): JSX.Element {
  return (
    <button
      className={`rounded-md px-3 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50 ${variantClass[variant]} ${className}`.trim()}
      {...props}
    />
  );
}

export default Button;
