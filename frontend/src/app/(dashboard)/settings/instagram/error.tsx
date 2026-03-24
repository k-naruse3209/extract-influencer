'use client'

import Link from 'next/link'

interface ErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

/**
 * Instagram連携設定画面のエラーバウンダリ。
 * サーバーコンポーネントで予期しないエラーが発生した場合に表示される。
 */
export default function InstagramSettingsError({ error, reset }: ErrorProps) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Instagram 連携</h1>
      </div>
      <div className="rounded-lg border border-red-200 bg-red-50 p-6">
        <h2 className="text-sm font-semibold text-red-800">
          ページの読み込みに失敗しました
        </h2>
        <p className="mt-1 text-sm text-red-700">{error.message}</p>
        {error.digest !== undefined && (
          <p className="mt-1 text-xs text-red-500">
            エラーID: {error.digest}
          </p>
        )}
        <div className="mt-4 flex gap-3">
          <button
            type="button"
            onClick={reset}
            className="rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-500"
          >
            再試行
          </button>
          <Link
            href="/settings"
            className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            設定へ戻る
          </Link>
        </div>
      </div>
    </div>
  )
}
