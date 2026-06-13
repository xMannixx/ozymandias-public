import type { ButtonHTMLAttributes } from "react";

type ButtonVariant = "primary" | "danger" | "ghost";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
};

const variantClass: Record<ButtonVariant, string> = {
  primary: "bg-blue-600 text-white hover:bg-blue-500",
  danger: "bg-red-600 text-white hover:bg-red-500",
  ghost: "bg-transparent text-gray-200 border border-gray-600 hover:bg-gray-800",
};

function Button({ variant = "primary", className = "", ...props }: ButtonProps): JSX.Element {
  return (
    <button
      className={`rounded-md px-3 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${variantClass[variant]} ${className}`.trim()}
      {...props}
    />
  );
}

export default Button;
