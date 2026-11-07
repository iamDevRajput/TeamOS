export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="max-w-2xl text-center space-y-6">
        <div className="inline-block px-3 py-1 text-xs font-semibold tracking-wider text-blue-700 uppercase bg-blue-50 rounded-full border border-blue-200">
          Delivery Risk Intelligence
        </div>
        <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl text-slate-900">
          TeamOS
        </h1>
        <p className="text-lg text-slate-600 leading-relaxed">
          Will we hit our delivery date, what is blocking it, and what changed?
          Deterministic risk calculations grounded in tasks, dependencies, and GitHub evidence.
        </p>
        <div className="pt-4 flex justify-center gap-4">
          <span className="inline-flex items-center rounded-md bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
            Phase 0: Foundation Ready
          </span>
        </div>
      </div>
    </main>
  );
}

