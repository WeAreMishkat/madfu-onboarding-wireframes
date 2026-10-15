/**
 * Low-fidelity wireframe component kit (black / white / gray only).
 * Every customer-facing screen is composed from these primitives so the
 * prototype, screen gallery and PDF stay visually consistent.
 */
import { useId, type ReactNode, createContext, useContext } from 'react';

const cx = (...c: (string | false | undefined | null)[]) => c.filter(Boolean).join(' ');

export function H1({ children }: { children: ReactNode }) {
  return <h1 className="text-[28px] font-semibold leading-tight tracking-tight text-black">{children}</h1>;
}
export function Lead({ children }: { children: ReactNode }) {
  return <p className="mt-2 max-w-[640px] text-[15px] leading-relaxed text-neutral-600">{children}</p>;
}
export function H2({ children }: { children: ReactNode }) {
  return <h2 className="text-[17px] font-semibold text-black">{children}</h2>;
}
export function Muted({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cx('text-[13px] leading-relaxed text-neutral-500', className)}>{children}</p>;
}

export function Field({
  label,
  hint,
  error,
  optional,
  children,
  htmlFor,
}: {
  label: string;
  hint?: string;
  error?: string;
  optional?: boolean;
  children: ReactNode;
  htmlFor?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-[14px] font-medium text-black">
        {label}
        {optional && <span className="ml-1 font-normal text-neutral-500">(optional)</span>}
      </label>
      {children}
      {hint && !error && <span className="text-[12px] text-neutral-500">{hint}</span>}
      {error && (
        <span role="alert" className="flex items-start gap-1.5 text-[13px] font-medium text-black">
          <span aria-hidden className="mt-[1px] inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 border-black text-[10px] leading-none font-bold">
            !
          </span>
          {error}
        </span>
      )}
    </div>
  );
}

export function TextInput({
  id,
  value,
  onChange,
  onBlur,
  placeholder,
  invalid,
  disabled,
  prefix,
  suffix,
  inputMode,
  ariaLabel,
  testId,
  maxLength,
  className,
}: {
  id?: string;
  value: string;
  onChange?: (v: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  invalid?: boolean;
  disabled?: boolean;
  prefix?: ReactNode;
  suffix?: ReactNode;
  inputMode?: 'text' | 'numeric' | 'tel' | 'url';
  ariaLabel?: string;
  testId?: string;
  maxLength?: number;
  className?: string;
}) {
  return (
    <div
      className={cx(
        'flex h-11 items-stretch overflow-hidden rounded-md border bg-white',
        invalid ? 'border-black border-2' : 'border-neutral-400',
        disabled && 'bg-neutral-100 border-neutral-300',
        className,
      )}
    >
      {prefix && <div className="flex items-center border-r border-neutral-300 bg-neutral-50 px-3 text-[14px] text-neutral-700">{prefix}</div>}
      <input
        id={id}
        aria-label={ariaLabel}
        aria-invalid={invalid || undefined}
        data-testid={testId}
        className="min-w-0 flex-1 px-3 text-[15px] text-black outline-none placeholder:text-neutral-400 disabled:text-neutral-600"
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        inputMode={inputMode}
        maxLength={maxLength}
        onChange={(e) => onChange?.(e.target.value)}
        onBlur={onBlur}
      />
      {suffix && <div className="flex items-center pr-3">{suffix}</div>}
    </div>
  );
}

export function Select({
  id,
  value,
  onChange,
  options,
  placeholder,
  invalid,
  disabled,
  testId,
}: {
  id?: string;
  value?: string;
  onChange: (v: string) => void;
  options: { value: string; label: string; disabled?: boolean }[];
  placeholder: string;
  invalid?: boolean;
  disabled?: boolean;
  testId?: string;
}) {
  return (
    <div className={cx('relative h-11 overflow-hidden rounded-md border bg-white', invalid ? 'border-black border-2' : 'border-neutral-400', disabled && 'bg-neutral-100')}>
      <select
        id={id}
        data-testid={testId}
        aria-invalid={invalid || undefined}
        disabled={disabled}
        className={cx('h-full w-full min-w-0 max-w-full appearance-none bg-transparent pl-3 pr-9 text-[15px] outline-none', value ? 'text-black' : 'text-neutral-400')}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="" disabled>
          {placeholder}
        </option>
        {options.map((o) => (
          <option key={o.value} value={o.value} disabled={o.disabled} className="text-black">
            {o.label}
          </option>
        ))}
      </select>
      <span aria-hidden className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-neutral-600">
        ▼
      </span>
    </div>
  );
}

/** Radio group rendered as segmented options or stacked option rows. */
export function RadioGroup<T extends string>({
  name,
  value,
  onChange,
  options,
  invalid,
  layout = 'segmented',
  disabled,
  ariaLabel,
}: {
  name: string;
  value?: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; description?: string }[];
  invalid?: boolean;
  layout?: 'segmented' | 'rows' | 'inline';
  disabled?: boolean;
  ariaLabel?: string;
}) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className={cx(layout === 'rows' ? 'flex flex-col gap-2' : 'flex gap-3', layout === 'segmented' && 'grid grid-cols-2')}>
      {options.map((o) => {
        const checked = value === o.value;
        return (
          <label
            key={o.value}
            className={cx(
              'flex cursor-pointer items-center gap-3 rounded-md border px-4 py-3 text-[15px]',
              checked ? 'border-2 border-black bg-neutral-50' : invalid ? 'border-2 border-black/70' : 'border-neutral-400',
              disabled && 'cursor-not-allowed opacity-60',
              layout === 'inline' && 'min-w-[120px]',
            )}
          >
            <input type="radio" className="sr-only" name={name} value={o.value} checked={checked} disabled={disabled} onChange={() => onChange(o.value)} />
            <span
              aria-hidden
              className={cx('inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-2', checked ? 'border-black' : 'border-neutral-500')}
            >
              {checked && <span className="h-2 w-2 rounded-full bg-black" />}
            </span>
            <span className="flex flex-col">
              <span className="font-medium text-black">{o.label}</span>
              {o.description && <span className="text-[13px] text-neutral-500">{o.description}</span>}
            </span>
          </label>
        );
      })}
    </div>
  );
}

export function Checkbox({ checked, onChange, label, invalid }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; invalid?: boolean }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 text-[14px] text-black">
      <input type="checkbox" className="sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span
        aria-hidden
        className={cx(
          'mt-0.5 inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[3px] border-2',
          checked ? 'border-black bg-black text-white' : invalid ? 'border-black' : 'border-neutral-500',
        )}
      >
        {checked && <span className="text-[11px] leading-none">✓</span>}
      </span>
      <span>{label}</span>
    </label>
  );
}

export function Button({
  children,
  onClick,
  variant = 'primary',
  disabled,
  loading,
  testId,
  type = 'button',
  size = 'md',
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'link' | 'danger-outline';
  disabled?: boolean;
  loading?: boolean;
  testId?: string;
  type?: 'button' | 'submit';
  size?: 'md' | 'sm';
}) {
  const base = cx(
    'inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors disabled:cursor-not-allowed',
    size === 'md' ? 'h-11 px-6 text-[15px]' : 'h-9 px-4 text-[14px]',
  );
  const styles = {
    primary: 'bg-black text-white hover:bg-neutral-800 disabled:bg-neutral-300 disabled:text-neutral-500',
    secondary: 'border border-neutral-500 bg-white text-black hover:bg-neutral-50 disabled:text-neutral-400 disabled:border-neutral-300',
    'danger-outline': 'border border-black bg-white text-black underline-offset-2 hover:bg-neutral-50',
    link: 'h-auto px-0 text-black underline underline-offset-4 hover:text-neutral-600 disabled:text-neutral-400 disabled:no-underline',
  }[variant];
  return (
    <button type={type} data-testid={testId} className={cx(base, styles)} disabled={disabled || loading} onClick={onClick}>
      {loading && <Spinner small />}
      {children}
    </button>
  );
}

export function Spinner({ small, label }: { small?: boolean; label?: string }) {
  return (
    <span className="inline-flex items-center gap-2" role="status">
      <span aria-hidden className={cx('inline-block animate-spin rounded-full border-2 border-neutral-300 border-t-current', small ? 'h-4 w-4' : 'h-6 w-6')} />
      {label && <span className="text-[14px] text-neutral-700">{label}</span>}
    </span>
  );
}

export function Alert({ kind = 'info', title, children, testId }: { kind?: 'info' | 'error' | 'warning' | 'success'; title?: string; children?: ReactNode; testId?: string }) {
  const glyph = { info: 'i', error: '!', warning: '!', success: '✓' }[kind];
  return (
    <div
      data-testid={testId}
      role={kind === 'error' ? 'alert' : 'status'}
      className={cx(
        'flex gap-3 rounded-md px-4 py-3',
        kind === 'error' ? 'border-2 border-black' : kind === 'warning' ? 'border border-black border-dashed' : 'border border-neutral-400 bg-neutral-50',
      )}
    >
      <span
        aria-hidden
        className={cx(
          'mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold',
          kind === 'success' || kind === 'error' ? 'bg-black text-white' : 'border-2 border-black',
        )}
      >
        {glyph}
      </span>
      <div className="flex flex-col gap-1 text-[14px] leading-relaxed text-black">
        {title && <span className="font-semibold">{title}</span>}
        {children && <div className="text-neutral-700">{children}</div>}
      </div>
    </div>
  );
}

export function Chip({ children, tone = 'neutral', testId }: { children: ReactNode; tone?: 'neutral' | 'solid' | 'outline' | 'dashed'; testId?: string }) {
  return (
    <span
      data-testid={testId}
      className={cx(
        'inline-flex h-6 items-center gap-1 whitespace-nowrap rounded-full px-2.5 text-[12px] font-medium',
        tone === 'solid' && 'bg-black text-white',
        tone === 'neutral' && 'bg-neutral-200 text-neutral-800',
        tone === 'outline' && 'border border-black text-black',
        tone === 'dashed' && 'border border-dashed border-neutral-600 text-neutral-700',
      )}
    >
      {children}
    </span>
  );
}

export function Card({
  children,
  className,
  selected,
  onClick,
  disabled,
  testId,
}: {
  children: ReactNode;
  className?: string;
  selected?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  testId?: string;
}) {
  return (
    <div
      data-testid={testId}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick && !disabled ? 0 : undefined}
      aria-pressed={onClick ? !!selected : undefined}
      aria-disabled={disabled || undefined}
      onClick={disabled ? undefined : onClick}
      onKeyDown={(e) => {
        if (!disabled && onClick && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick();
        }
      }}
      className={cx(
        'rounded-md border bg-white',
        selected ? 'border-2 border-black' : 'border-neutral-300',
        onClick && !disabled && 'cursor-pointer hover:border-neutral-600',
        disabled && 'bg-neutral-50 opacity-70',
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Radio indicator for selectable cards/rows. */
export function RadioDot({ checked }: { checked: boolean }) {
  return (
    <span aria-hidden className={cx('inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2', checked ? 'border-black' : 'border-neutral-500')}>
      {checked && <span className="h-2.5 w-2.5 rounded-full bg-black" />}
    </span>
  );
}

export function Divider() {
  return <hr className="border-neutral-200" />;
}

export function ErrorSummary({ errors }: { errors: Record<string, string> }) {
  const entries = Object.entries(errors);
  if (entries.length < 2) return null;
  return (
    <Alert kind="error" title={`Please fix ${entries.length} fields to continue`} testId="error-summary">
      <ul className="list-disc pl-5">
        {entries.map(([k, v]) => (
          <li key={k}>{v}</li>
        ))}
      </ul>
    </Alert>
  );
}

/** Prototype-only development simulator strip. Visually distinct (dashed) and labelled. */
/** Presentation mode (Simplified Master Board): hides prototype-only development tools. Off by default. */
export const PresentationContext = createContext(false);

export function DevSimulator({ children, note }: { children: ReactNode; note?: string }) {
  const presentation = useContext(PresentationContext);
  if (presentation) return null;
  return (
    <div
      data-testid="dev-simulator"
      className="rounded-md border-2 border-dashed border-neutral-500 bg-[repeating-linear-gradient(45deg,#fafafa,#fafafa_8px,#f1f1f1_8px,#f1f1f1_16px)] px-4 py-3"
    >
      <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-700">
        <span className="rounded-sm bg-neutral-700 px-1.5 py-0.5 text-white">DEV</span>
        Development simulator — prototype only, not part of the product UI
      </div>
      {note && <p className="mb-2 text-[12px] text-neutral-600">{note}</p>}
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

export function useFieldId(prefix: string) {
  return `${prefix}-${useId().replace(/:/g, '')}`;
}

export function KeyValue({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-[200px_1fr] gap-x-6 gap-y-3 text-[14px]">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-neutral-500">{k}</dt>
          <dd className="font-medium text-black">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Modal({ title, children, actions }: { title: string; children: ReactNode; actions: ReactNode }) {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40" role="dialog" aria-modal="true" aria-label={title}>
      <div className="w-[480px] rounded-lg border border-black bg-white p-6 shadow-xl">
        <H2>{title}</H2>
        <div className="mt-2 text-[14px] leading-relaxed text-neutral-700">{children}</div>
        <div className="mt-6 flex justify-end gap-3">{actions}</div>
      </div>
    </div>
  );
}
