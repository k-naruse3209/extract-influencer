/**
 * 比較画面のローディングスケルトン。
 * Suspense フォールバックとして Next.js が自動的に使用する。
 */
export default function CompareLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="h-8 w-32 animate-pulse rounded bg-gray-200" />
          <div className="mt-2 h-4 w-48 animate-pulse rounded bg-gray-100" />
        </div>
        <div className="flex gap-3">
          <div className="h-10 w-24 animate-pulse rounded-md bg-gray-100" />
          <div className="h-10 w-32 animate-pulse rounded-md bg-gray-200" />
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200">
        <div className="bg-gray-50 px-4 py-3">
          <div className="flex gap-4">
            <div className="h-6 w-28 animate-pulse rounded bg-gray-200" />
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-6 w-36 animate-pulse rounded bg-gray-200"
              />
            ))}
          </div>
        </div>
        <div className="divide-y divide-gray-200 bg-white">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex gap-4 px-4 py-3">
              <div className="h-5 w-28 animate-pulse rounded bg-gray-100" />
              {Array.from({ length: 4 }).map((_, j) => (
                <div
                  key={j}
                  className="h-5 w-36 animate-pulse rounded bg-gray-100"
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
