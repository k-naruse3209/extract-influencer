import { cookies } from 'next/headers'
import Link from 'next/link'
import type { DashboardStats } from '@/types/api'
import { formatDate, formatScore } from '@/lib/format'

async function fetchDashboardStats(): Promise<DashboardStats> {
  const backendUrl = process.env.BACKEND_URL ?? 'http://localhost:3001'
  const cookieStore = await cookies()

  const response = await fetch(`${backendUrl}/api/v1/dashboard/stats`, {
    headers: { Cookie: cookieStore.toString() },
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error(
      `ダッシュボード統計の取得に失敗しました (${response.status})`,
    )
  }

  const body: unknown = await response.json()
  return body as DashboardStats
}

function StatCard({
  label,
  value,
  description,
}: {
  label: string
  value: string
  description?: string
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
      <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{label}</p>
      <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
      {description !== undefined && (
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{description}</p>
      )}
    </div>
  )
}

function ReportStatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string }> = {
    PENDING: { label: '待機中', className: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300' },
    PROCESSING: { label: '処理中', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
    COMPLETED: { label: '完了', className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
    FAILED: { label: '失敗', className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
  }

  const { label, className } =
    config[status] ?? { label: status, className: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300' }

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${className}`}
    >
      {label}
    </span>
  )
}

export default async function DashboardPage() {
  let stats: DashboardStats | null = null
  let fetchError: string | null = null

  try {
    stats = await fetchDashboardStats()
  } catch (error) {
    fetchError =
      error instanceof Error ? error.message : 'データの取得に失敗しました'
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">ダッシュボード</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          インフルエンサー候補の分析・比較・レポート出力
        </p>
      </div>

      {fetchError !== null ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300">
          {fetchError}
        </div>
      ) : stats === null ? (
        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center dark:border-gray-700 dark:bg-gray-800">
          <p className="text-gray-500 dark:text-gray-400">データを取得できませんでした。</p>
        </div>
      ) : (
        <>
          {/* 統計カード */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="登録候補数"
              value={stats.totalProfiles.toLocaleString('ja-JP')}
              description="プラットフォーム全体"
            />
            <StatCard
              label="保存済み候補数"
              value={stats.savedCandidates.toLocaleString('ja-JP')}
              description="あなたが保存した候補"
            />
            <StatCard
              label="生成レポート数"
              value={stats.totalReports.toLocaleString('ja-JP')}
              description="あなたが生成したレポート"
            />
            <StatCard
              label="平均スコア"
              value={
                stats.averageScore !== null
                  ? formatScore(stats.averageScore)
                  : '—'
              }
              description="全候補の総合スコア平均"
            />
          </div>

          {/* 最近の活動 */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* 最近保存した候補 */}
            <div className="rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
              <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700">
                <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  最近保存した候補
                </h2>
                <Link
                  href="/saved"
                  className="text-xs text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300"
                >
                  すべて見る
                </Link>
              </div>

              {stats.recentSaved.length === 0 ? (
                <div className="px-6 py-8 text-center">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    保存済みの候補がありません。
                  </p>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    候補検索から候補を保存できます。
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-gray-100 dark:divide-gray-700">
                  {stats.recentSaved.map((item) => (
                    <li key={item.id} className="px-6 py-3">
                      <div className="flex items-center justify-between">
                        <div className="min-w-0 flex-1">
                          <Link
                            href={`/candidates/${item.profileId}`}
                            className="text-sm font-medium text-gray-900 hover:text-indigo-600 dark:text-gray-100 dark:hover:text-indigo-400"
                          >
                            {item.username}
                          </Link>
                          {item.displayName !== null && (
                            <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                              {item.displayName}
                            </span>
                          )}
                        </div>
                        <time className="ml-4 shrink-0 text-xs text-gray-500 dark:text-gray-400">
                          {formatDate(item.savedAt)}
                        </time>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* 最近のレポート */}
            <div className="rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
              <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700">
                <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  最近のレポート
                </h2>
                <Link
                  href="/reports"
                  className="text-xs text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300"
                >
                  すべて見る
                </Link>
              </div>

              {stats.recentReports.length === 0 ? (
                <div className="px-6 py-8 text-center">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    レポートがありません。
                  </p>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    候補詳細画面からレポートを生成できます。
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-gray-100 dark:divide-gray-700">
                  {stats.recentReports.map((report) => (
                    <li key={report.id} className="px-6 py-3">
                      <div className="flex items-center justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                            {report.title}
                          </p>
                          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                            {report.format}
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1">
                          <ReportStatusBadge status={report.status} />
                          <time className="text-xs text-gray-500 dark:text-gray-400">
                            {formatDate(report.createdAt)}
                          </time>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* クイックアクション */}
          <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
            <h2 className="mb-4 text-sm font-semibold text-gray-900 dark:text-gray-100">
              クイックアクション
            </h2>
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Link
                href="/candidates"
                className="inline-flex items-center justify-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 sm:justify-start dark:bg-indigo-500 dark:hover:bg-indigo-400"
              >
                候補を検索
              </Link>
              <Link
                href="/saved"
                className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 sm:justify-start dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
              >
                保存済み候補を見る
              </Link>
              <Link
                href="/reports"
                className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 sm:justify-start dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
              >
                レポートを見る
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
