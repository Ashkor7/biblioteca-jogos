export default function PageHeader({ title, children, actions, kicker }) {
  return (
    <header className="mb-6 flex flex-col gap-4 pb-1 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {kicker && <p className="hud-label mb-1.5 text-cyan">{kicker}</p>}
        <h1 className="panel-heading break-words">{title}</h1>
        {children && <div className="mt-2 max-w-2xl text-sm text-muted">{children}</div>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}
