"use client"

export function ContentSection({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <section className="space-y-6 border border-[color:var(--border)] bg-[color:var(--surface)] p-6">
      <div>
        <h2 className="font-display text-lg font-bold text-[color:var(--heading)]">{title}</h2>
        {description && <p className="mt-1 text-sm leading-relaxed text-[color:var(--muted-foreground)]">{description}</p>}
        <div className="mt-4 h-px bg-[color:var(--border)]" />
      </div>
      {children}
    </section>
  )
}
