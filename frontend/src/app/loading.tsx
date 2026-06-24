export default function Loading() {
  return (
    <div className="max-w-[1440px] mx-auto px-3 sm:px-4 py-4 sm:py-6">
      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4 animate-pulse">
          <div className="skeleton h-3 w-16 mb-2" />
          <div className="skeleton h-6 w-24" />
        </div>
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4 animate-pulse">
          <div className="skeleton h-3 w-16 mb-2" />
          <div className="skeleton h-6 w-12" />
        </div>
      </div>

      <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="skeleton h-8 w-20 rounded-full shrink-0" />
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 md:gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl overflow-hidden animate-pulse">
            <div className="skeleton w-full h-36 sm:h-40 rounded-none" />
            <div className="p-3 space-y-2">
              <div className="skeleton h-3 w-3/4" />
              <div className="skeleton h-2 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
