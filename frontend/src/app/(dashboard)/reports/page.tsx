import { cookies } from 'next/headers'
import type { Report } from '@/types/api'
import { ReportDownloadButton } from '@/components/report-download-button'
import { cn } from '@/lib/utils'

async function fetchReports(): Promise<Report[]> {
  const backendUrl = process.env.BACKEND_URL ?? 'http://localhost:3001'
  const cookieStore = await cookies()

  const response = await fetch(`${backendUrl}/api/v1/reports`, {
    headers: { Cookie: cookieStore.toString() },
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error(`レポート一覧の取得に失敗しました (${response.status})`)
  }

  const body: unknown = await response.json()
  return body as Report[]
}

function StatusBadge({ status }: { status: Report['status'] }) {
  const config: Record<
    Report['status'],
    { label: string; className: string; spinner: boolean }
  > = {
    PENDING: {
      label: '待機中',
      className: 'bg-gray-100 text-gray-600 ring-gray-200',
      spinner: true,
    },
    PROCESSING: {
      label: '処理中',
      className: 'bg-blue-100 text-blue-700 ring-blue-200',
      spinner: true,
    },
    COMPLETED: {
      label: '完了',
      className: 'bg-green-100 text-green-700 ring-green-200',
      spinner: false,
    },
    FAILED: {
      label: '失敗',
      className: 'bg-red-100 text-red-700 ring-red-200',
      spinner: false,
    },
  }

  const { label, className, spinner } = config[status]

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
        className,
      )}
    >
      {spinner && (
        <span
          className="inline-block h-2.5 w-2.5 animate-spin rounded-full border-2 border-current border-t-transparent"
          aria-hidden="true"
        />
      )}
      {label}
    </span>
  )
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default async function ReportsPage() {
  let reports: Report[]

  try {
    reports = await fetchReports()
  } catch {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">レポート</h1>
        </div>
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-sm text-red-700">
          データの取得に失敗しました。しばらく待ってから再読み込みしてください。
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">レポート</h1>
        <p className="mt-1 text-sm text-gray-600">
          生成済みレポートの一覧。候補詳細画面からレポートを生成できます。
        </p>
      </div>

      {reports.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
          <p className="text-gray-500">レポートがありません。</p>
          <p className="mt-1 text-xs text-gray-400">
            候補詳細画面の「レポート生成」からレポートを作成できます。
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  タイトル
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  種別
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  形式
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  ステータス
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                  サイズ
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  生成日時
                </th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {reports.map((report) => (
                <tr key={report.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">
                    {report.title}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600">
                    {report.reportType}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600">
                    {report.format}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4">
                    <StatusBadge status={report.status} />
                    {report.errorMessage !== null && (
                      <p
                        className="mt-1 max-w-xs truncate text-xs text-red-600"
                        title={report.errorMessage}
                      >
                        {report.errorMessage}
                      </p>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-right text-sm text-gray-600">
                    {report.fileSize !== null
                      ? formatFileSize(report.fileSize)
                      : <span className="text-gray-400">—</span>}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600">
                    {report.generatedAt !== null
                      ? new Date(report.generatedAt).toLocaleString('ja-JP', {
                          timeZone: 'Asia/Tokyo',
                        })
                      : <span className="text-gray-400">—</span>}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-right">
                    {report.status === 'COMPLETED' && (
                      <ReportDownloadButton
                        reportId={report.id}
                        filename={`${report.title}.${report.format.toLowerCase()}`}
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
