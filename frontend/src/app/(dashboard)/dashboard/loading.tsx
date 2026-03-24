/**
 * ダッシュボードのスケルトンローダー。
 * Server Component のデータ取得中に表示される。
 */
export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="h-8 w-48 animate-pulse rounded bg-gray-200" />
        <div className="mt-2 h-4 w-80 animate-pulse rounded bg-gray-100" />
      </div>

      {/* 統計カードのスケルトン */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-lg border border-gray-200 bg-white p-6"
          >
            <div className="h-4 w-24 animate-pulse rounded bg-gray-200" />
            <div className="mt-3 h-8 w-20 animate-pulse rounded bg-gray-200" />
            <div className="mt-2 h-3 w-32 animate-pulse rounded bg-gray-100" />
          </div>
        ))}
      </div>

      {/* 最近の活動のスケルトン */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div
            key={i}
            className="rounded-lg border border-gray-200 bg-white"
          >
            <div className="border-b border-gray-200 px-6 py-4">
              <div className="h-4 w-36 animate-pulse rounded bg-gray-200" />
            </div>
            <div className="divide-y divide-gray-100">
              {Array.from({ length: 4 }).map((_, j) => (
                <div key={j} className="flex items-center justify-between px-6 py-3">
                  <div className="h-4 w-32 animate-pulse rounded bg-gray-200" />
                  <div className="h-3 w-20 animate-pulse rounded bg-gray-100" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* クイックアクションのスケルトン */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="mb-4 h-4 w-32 animate-pulse rounded bg-gray-200" />
        <div className="flex gap-3">
          <div className="h-9 w-28 animate-pulse rounded-md bg-gray-200" />
          <div className="h-9 w-36 animate-pulse rounded-md bg-gray-100" />
          <div className="h-9 w-32 animate-pulse rounded-md bg-gray-100" />
        </div>
      </div>
    </div>
  )
}
