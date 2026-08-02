import type { ReactNode } from "react";

type SettingFieldProps = {
  label: string;
  /** Plain-language explanation of what this single control does. */
  description?: string;
  /** Consequence or example shown below the control, e.g. "Currently: every 24 hours". */
  hint?: ReactNode;
  htmlFor?: string;
  children: ReactNode;
};

function SettingField({ label, description, hint, htmlFor, children }: SettingFieldProps): JSX.Element {
  return (
    <div className="space-y-2">
      <div>
        {htmlFor ? (
          <label htmlFor={htmlFor} className="text-sm font-medium text-zinc-200">
            {label}
          </label>
        ) : (
          <p className="text-sm font-medium text-zinc-200">{label}</p>
        )}
        {description ? <p className="mt-0.5 text-xs leading-relaxed text-zinc-400">{description}</p> : null}
      </div>
      {children}
      {hint ? <p className="text-xs text-zinc-500">{hint}</p> : null}
    </div>
  );
}

export default SettingField;
