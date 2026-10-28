export default function PageHeader({ title, children, actions, kicker }) {
  return (
    <header className="mb-6 flex flex-col gap-4 border-b border-line pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {kicker && <p className="mb-1 text-sm text-muted">{kicker}</p>}
        <h1 className="text-[clamp(1.7rem,4vw,2.5rem)] font-bold break-words">{title}</h1>
        {children && <div className="mt-2 max-w-2xl text-sm text-muted">{children}</div>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}
