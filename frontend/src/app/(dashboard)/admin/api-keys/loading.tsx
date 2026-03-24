export default function AdminApiKeysLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="h-8 w-40 animate-pulse rounded bg-gray-200" />
          <div className="mt-2 h-4 w-64 animate-pulse rounded bg-gray-100" />
        </div>
        <div className="h-9 w-36 animate-pulse rounded bg-gray-200" />
      </div>

      <div className="h-12 animate-pulse rounded-lg bg-blue-50" />

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <div className="h-10 bg-gray-50" />
        <div className="divide-y divide-gray-200">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-6 py-4">
              <div className="h-4 w-40 animate-pulse rounded bg-gray-100" />
              <div className="h-5 w-24 animate-pulse rounded bg-gray-100" />
              <div className="h-5 w-12 animate-pulse rounded-full bg-gray-100" />
              <div className="h-4 w-32 animate-pulse rounded bg-gray-100" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
