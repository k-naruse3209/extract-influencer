import Link from 'next/link'

/**
 * グローバル 404 ページ。
 * 存在しないルートへアクセスされた場合に表示される。
 */
export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="text-center">
        <p className="text-6xl font-bold text-indigo-600 dark:text-indigo-400">404</p>
        <h1 className="mt-4 text-2xl font-bold text-gray-900 dark:text-gray-100">
          ページが見つかりません
        </h1>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          お探しのページは存在しないか、移動した可能性があります。
        </p>
        <Link
          href="/"
          className="mt-8 inline-block rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:bg-indigo-500 dark:hover:bg-indigo-400"
        >
          ホームへ戻る
        </Link>
      </div>
    </div>
  )
}
