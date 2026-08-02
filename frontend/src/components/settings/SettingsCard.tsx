import type { ReactNode } from "react";

type SettingsCardProps = {
  title: string;
  /** One plain-language sentence explaining what this card controls. */
  description: string;
  badge?: ReactNode;
  children: ReactNode;
  /** Save button and status messages. */
  footer?: ReactNode;
};

function SettingsCard({ title, description, badge, children, footer }: SettingsCardProps): JSX.Element {
  return (
    <section className="glass-card p-5">
      <div className="mb-4 flex items-start justify-between gap-3 border-b border-white/[0.06] pb-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-white">{title}</h3>
          <p className="mt-1 text-xs leading-relaxed text-zinc-400">{description}</p>
        </div>
        {badge ? <div className="shrink-0">{badge}</div> : null}
      </div>

      <div className="space-y-5">{children}</div>

      {footer ? (
        <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-white/[0.06] pt-4">{footer}</div>
      ) : null}
    </section>
  );
}

export default SettingsCard;
