'use client'

import Link from 'next/link'

interface ErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

/**
 * グローバルエラーバウンダリ。
 * ルートレイアウト配下で予期しないエラーが発生した場合に表示される。
 */
export default function GlobalError({ error, reset }: ErrorProps) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="w-full max-w-md rounded-lg border border-red-200 bg-white p-8 shadow-sm dark:border-red-800 dark:bg-gray-800">
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
          予期しないエラーが発生しました
        </h1>
        <p className="mt-2 text-sm text-red-700 dark:text-red-300">{error.message}</p>
        {error.digest !== undefined && (
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            エラーID: {error.digest}
          </p>
        )}
        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={reset}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:bg-indigo-500 dark:hover:bg-indigo-400"
          >
            再試行
          </button>
          <Link
            href="/"
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            ホームへ戻る
          </Link>
        </div>
      </div>
    </div>
  )
}
