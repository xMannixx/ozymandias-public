import type { HTMLAttributes, PropsWithChildren } from "react";

type GlassCardProps = PropsWithChildren<
  {
    className?: string;
  } & HTMLAttributes<HTMLElement>
>;

function GlassCard({ children, className = "", ...props }: GlassCardProps): JSX.Element {
  return (
    <section className={`glass-card p-4 ${className}`.trim()} {...props}>
      {children}
    </section>
  );
}

export default GlassCard;
