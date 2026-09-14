"use client"

interface FieldRowProps {
  label: string
  value: string
  onChange: (v: string) => void
  multiline?: boolean
  type?: string
  placeholder?: string
  hint?: string
  dir?: "rtl" | "ltr"
  disabled?: boolean
}

export function FieldRow({ label, value, onChange, multiline, type = "text", placeholder, hint, dir, disabled }: FieldRowProps) {
  const cls =
    "w-full bg-[color:var(--background)] border border-[color:var(--input)] text-[color:var(--card-foreground)] placeholder:text-[color:var(--muted-foreground)] px-3.5 py-2.5 text-sm focus:border-[color:var(--primary)] focus:outline-none transition-colors disabled:opacity-50"

  return (
    <div className="space-y-1.5">
      <label className="block text-[0.7rem] uppercase tracking-widest text-[color:var(--muted-foreground)]">{label}</label>
      {multiline ? (
        <textarea
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={4}
          dir={dir}
          disabled={disabled}
          className={`${cls} resize-y`}
        />
      ) : (
        <input
          type={type}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          dir={dir}
          disabled={disabled}
          className={cls}
        />
      )}
      {hint && <p className="text-[0.7rem] leading-relaxed text-[color:var(--muted-foreground)]">{hint}</p>}
    </div>
  )
}
