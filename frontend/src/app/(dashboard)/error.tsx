'use client'

import Link from 'next/link'

interface ErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

/**
 * ダッシュボードレイアウト配下のエラーバウンダリ。
 * ダッシュボード内のどのページでもキャッチされなかったエラーに対して表示される。
 */
export default function DashboardLayoutError({ error, reset }: ErrorProps) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center">
      <div className="w-full max-w-md rounded-lg border border-red-200 bg-red-50 p-8 dark:border-red-800 dark:bg-red-900/30">
        <h1 className="text-lg font-bold text-red-900 dark:text-red-200">
          エラーが発生しました
        </h1>
        <p className="mt-2 text-sm text-red-700 dark:text-red-300">{error.message}</p>
        {error.digest !== undefined && (
          <p className="mt-1 text-xs text-red-400 dark:text-red-400">
            エラーID: {error.digest}
          </p>
        )}
        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={reset}
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 dark:bg-red-700 dark:hover:bg-red-600"
          >
            再試行
          </button>
          <Link
            href="/dashboard"
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            ダッシュボードへ戻る
          </Link>
        </div>
      </div>
    </div>
  )
}
