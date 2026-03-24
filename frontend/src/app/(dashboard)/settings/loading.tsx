export default function SettingsLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="h-8 w-20 animate-pulse rounded bg-gray-200" />
        <div className="mt-2 h-4 w-72 animate-pulse rounded bg-gray-100" />
      </div>

      <div className="flex flex-col gap-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div
            key={i}
            className="h-16 animate-pulse rounded-lg border border-gray-100 bg-gray-50"
          />
        ))}
      </div>
    </div>
  )
}
