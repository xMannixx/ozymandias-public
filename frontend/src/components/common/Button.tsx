import type { ButtonHTMLAttributes } from "react";

type ButtonVariant = "primary" | "danger" | "ghost";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
};

const variantClass: Record<ButtonVariant, string> = {
  primary: "bg-indigo-500 text-white hover:bg-indigo-400",
  danger: "bg-red-500/90 text-white hover:bg-red-500",
  ghost:
    "border border-white/[0.09] bg-white/[0.02] text-zinc-200 hover:border-white/[0.14] hover:bg-white/[0.05]",
};

function Button({ variant = "primary", className = "", ...props }: ButtonProps): JSX.Element {
  return (
    <button
      className={`rounded-md px-3 py-2 text-sm font-medium transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50 ${variantClass[variant]} ${className}`.trim()}
      {...props}
    />
  );
}

export default Button;
