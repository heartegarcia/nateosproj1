export function ComingSoon({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <div className="max-w-sm text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-400">
          🚧
        </div>
        <h1 className="text-lg font-semibold text-zinc-900">{title}</h1>
        <p className="mt-1.5 text-sm text-zinc-500">{description}</p>
        <p className="mt-4 text-xs text-zinc-400">Coming in a later build phase.</p>
      </div>
    </div>
  );
}
