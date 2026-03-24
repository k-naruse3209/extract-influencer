export default function CandidatesLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="h-8 w-40 animate-pulse rounded bg-gray-200" />
        <div className="mt-2 h-4 w-72 animate-pulse rounded bg-gray-100" />
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="flex gap-3">
          <div className="h-10 w-48 animate-pulse rounded bg-gray-100" />
          <div className="h-10 w-32 animate-pulse rounded bg-gray-100" />
        </div>
      </div>

      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-14 animate-pulse rounded-lg bg-gray-100" />
        ))}
      </div>
    </div>
  )
}
