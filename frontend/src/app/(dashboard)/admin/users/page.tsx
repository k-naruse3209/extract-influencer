import { cookies } from 'next/headers'
import type { AdminUser } from '@/types/api'
import { CreateUserButton, UserTableRow } from './user-actions'

async function fetchUsers(): Promise<AdminUser[] | null> {
  const backendUrl = process.env.BACKEND_URL ?? 'http://localhost:3001'
  const cookieStore = await cookies()

  const response = await fetch(`${backendUrl}/api/v1/admin/users`, {
    headers: { Cookie: cookieStore.toString() },
    cache: 'no-store',
  })

  if (response.status === 404) {
    return null
  }

  if (!response.ok) {
    throw new Error(`ユーザー一覧の取得に失敗しました (${response.status})`)
  }

  const body = (await response.json()) as { users: AdminUser[] }
  return body.users
}

export default async function AdminUsersPage() {
  let users: AdminUser[] | null

  try {
    users = await fetchUsers()
  } catch {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">ユーザー管理</h1>
        </div>
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300">
          データの取得に失敗しました。しばらく待ってから再読み込みしてください。
        </div>
      </div>
    )
  }

  if (users === null) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">ユーザー管理</h1>
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">ユーザー管理</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            プラットフォームのユーザーを管理します
          </p>
        </div>
        <CreateUserButton />
      </div>

      {users.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-12 text-center dark:border-gray-700 dark:bg-gray-800">
          <p className="text-gray-500 dark:text-gray-400">ユーザーが存在しません。</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <caption className="sr-only">ユーザー一覧</caption>
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  名前
                </th>
                <th scope="col" className="hidden px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 sm:table-cell">
                  メールアドレス
                </th>
                <th scope="col" className="hidden px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 md:table-cell">
                  ロール
                </th>
                <th scope="col" className="hidden px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 md:table-cell">
                  状態
                </th>
                <th scope="col" className="hidden px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 lg:table-cell">
                  最終ログイン
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
              {users.map((user) => (
                <UserTableRow key={user.id} user={user} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
