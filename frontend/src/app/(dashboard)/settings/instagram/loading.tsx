export default function InstagramSettingsLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="h-8 w-48 animate-pulse rounded bg-gray-200" />
        <div className="mt-2 h-4 w-80 animate-pulse rounded bg-gray-100" />
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="h-5 w-24 animate-pulse rounded bg-gray-200" />
        <div className="mt-4 flex flex-col gap-3">
          <div className="h-5 w-64 animate-pulse rounded bg-gray-100" />
          <div className="h-9 w-28 animate-pulse rounded bg-gray-100" />
        </div>
      </div>
    </div>
  )
}
