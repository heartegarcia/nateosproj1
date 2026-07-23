export function BusinessChip({ name, color }: { name: string; color: string }) {
  return (
    <span
      className="inline-flex max-w-[9rem] items-center gap-1.5 truncate rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ backgroundColor: `${color}1a`, color }}
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
      <span className="truncate">{name}</span>
    </span>
  );
}
