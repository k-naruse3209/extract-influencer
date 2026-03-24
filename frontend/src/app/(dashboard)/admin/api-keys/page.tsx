import { cookies } from 'next/headers'
import { cn } from '@/lib/utils'
import type { AdminApiKey } from '@/types/api'
import { CreateApiKeyButton, ApiKeyRowActions } from './api-key-actions'

async function fetchApiKeys(): Promise<AdminApiKey[] | null> {
  const backendUrl = process.env.BACKEND_URL ?? 'http://localhost:3001'
  const cookieStore = await cookies()

  const response = await fetch(`${backendUrl}/api/v1/admin/api-keys`, {
    headers: { Cookie: cookieStore.toString() },
    cache: 'no-store',
  })

  if (response.status === 404) {
    return null
  }

  if (!response.ok) {
    throw new Error(`APIキー一覧の取得に失敗しました (${response.status})`)
  }

  const body = (await response.json()) as { apiKeys: AdminApiKey[] }
  return body.apiKeys
}

function formatKeyPrefix(prefix: string): string {
  return `${prefix}...`
}

export default async function AdminApiKeysPage() {
  let apiKeys: AdminApiKey[] | null

  try {
    apiKeys = await fetchApiKeys()
  } catch {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">APIキー管理</h1>
        </div>
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300">
          データの取得に失敗しました。しばらく待ってから再読み込みしてください。
        </div>
      </div>
    )
  }

  if (apiKeys === null) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">APIキー管理</h1>
        </div>
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-6 text-sm text-yellow-800 dark:border-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300">
          管理APIは準備中です。バックエンドの設定をご確認ください。
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">APIキー管理</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            APIキーの生成・無効化・削除を行います
          </p>
        </div>
        <CreateApiKeyButton />
      </div>

      <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 dark:border-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
        APIキーはキーのプレフィックス（先頭8文字）のみ表示されます。生成直後に全文をコピーして安全な場所に保管してください。
      </div>

      {apiKeys.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-12 text-center dark:border-gray-700 dark:bg-gray-800">
          <p className="text-gray-500 dark:text-gray-400">APIキーがありません。</p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            「新規キー生成」ボタンからAPIキーを作成してください。
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <caption className="sr-only">APIキー一覧</caption>
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  キー名
                </th>
                <th scope="col" className="hidden px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 sm:table-cell">
                  プレフィックス
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  状態
                </th>
                <th scope="col" className="hidden px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 lg:table-cell">
                  最終使用日時
                </th>
                <th scope="col" className="hidden px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 md:table-cell">
                  有効期限
                </th>
                <th scope="col" className="hidden px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 lg:table-cell">
                  作成日
                </th>
                <th scope="col" className="px-6 py-3">
                  <span className="sr-only">操作</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-800">
              {apiKeys.map((apiKey) => {
                const isExpired =
                  apiKey.expiresAt !== null &&
                  new Date(apiKey.expiresAt) < new Date()

                return (
                  <tr key={apiKey.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900 dark:text-gray-100">
                      {apiKey.name}
                    </td>
                    <td className="hidden whitespace-nowrap px-6 py-4 sm:table-cell">
                      <code className="rounded bg-gray-100 px-2 py-0.5 text-xs font-mono text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                        {formatKeyPrefix(apiKey.prefix)}
                      </code>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <span
                        className={cn(
                          'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold',
                          apiKey.isRevoked || isExpired
                            ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                            : 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
                        )}
                      >
                        {apiKey.isRevoked
                          ? '無効'
                          : isExpired
                          ? '期限切れ'
                          : '有効'}
                      </span>
                    </td>
                    <td className="hidden whitespace-nowrap px-6 py-4 text-sm text-gray-500 dark:text-gray-400 lg:table-cell">
                      {apiKey.lastUsedAt !== null
                        ? new Date(apiKey.lastUsedAt).toLocaleString('ja-JP')
                        : <span className="text-gray-500 dark:text-gray-400" aria-label="未使用">—</span>}
                    </td>
                    <td className="hidden whitespace-nowrap px-6 py-4 text-sm text-gray-500 dark:text-gray-400 md:table-cell">
                      {apiKey.expiresAt !== null ? (
                        <span className={isExpired ? 'text-red-600 dark:text-red-400' : undefined}>
                          {new Date(apiKey.expiresAt).toLocaleString('ja-JP')}
                        </span>
                      ) : (
                        <span className="text-gray-500 dark:text-gray-400">無期限</span>
                      )}
                    </td>
                    <td className="hidden whitespace-nowrap px-6 py-4 text-sm text-gray-500 dark:text-gray-400 lg:table-cell">
                      {new Date(apiKey.createdAt).toLocaleDateString('ja-JP')}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-right">
                      <ApiKeyRowActions apiKey={apiKey} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
