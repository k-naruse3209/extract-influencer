import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import Link from 'next/link'
import type { User } from '@/types/api'
import { ApiClientError } from '@/lib/api-client'
import { MobileNav } from '@/components/mobile-nav'
import { ThemeToggle } from '@/components/theme-toggle'

/**
 * バックエンドに認証チェックを行うServer Component用のfetch。
 * next/headers の cookies() でhttpOnly Cookieをリクエストに含める。
 * 未認証の場合は null を返す。
 */
async function getCurrentUser(): Promise<User | null> {
  const cookieStore = await cookies()
  const cookieHeader = cookieStore.toString()

  const backendUrl = process.env.BACKEND_URL ?? 'http://localhost:3001'

  try {
    const response = await fetch(`${backendUrl}/api/v1/auth/me`, {
      headers: {
        Cookie: cookieHeader,
      },
      cache: 'no-store',
    })

    if (!response.ok) {
      return null
    }

    const body: unknown = await response.json()
    return body as User
  } catch (error) {
    if (error instanceof ApiClientError) {
      return null
    }
    return null
  }
}

interface DashboardLayoutProps {
  children: React.ReactNode
}

export default async function DashboardLayout({
  children,
}: DashboardLayoutProps) {
  const user = await getCurrentUser()

  if (user === null) {
    redirect('/login')
  }

  const isAdmin = user.role === 'ADMIN'

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* デスクトップサイドバー: md以上で表示 */}
      <aside className="hidden w-64 flex-shrink-0 border-r border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 md:flex md:flex-col">
        <div className="flex h-16 items-center border-b border-gray-200 px-6 dark:border-gray-700">
          <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Influencer Platform
          </span>
        </div>
        <nav aria-label="メインナビゲーション" className="p-4">
          <ul className="space-y-1">
            <li>
              <Link
                href="/dashboard"
                className="flex items-center rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                ダッシュボード
              </Link>
            </li>
            <li>
              <Link
                href="/candidates"
                className="flex items-center rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                候補検索
              </Link>
            </li>
            <li>
              <Link
                href="/saved"
                className="flex items-center rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                保存済み
              </Link>
            </li>
            <li>
              <Link
                href="/reports"
                className="flex items-center rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                レポート
              </Link>
            </li>
            <li>
              <Link
                href="/settings"
                className="flex items-center rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                設定
              </Link>
            </li>
          </ul>

          {isAdmin && (
            <div className="mt-6">
              <p className="mb-1 px-3 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                管理
              </p>
              <ul className="space-y-1" aria-label="管理メニュー">
                <li>
                  <Link
                    href="/admin/users"
                    className="flex items-center rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:text-gray-300 dark:hover:bg-gray-700"
                  >
                    ユーザー管理
                  </Link>
                </li>
                <li>
                  <Link
                    href="/admin/api-keys"
                    className="flex items-center rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:text-gray-300 dark:hover:bg-gray-700"
                  >
                    APIキー管理
                  </Link>
                </li>
              </ul>
            </div>
          )}
        </nav>
      </aside>

      {/* メインコンテンツ */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-gray-200 bg-white px-4 dark:border-gray-700 dark:bg-gray-800 md:px-6">
          {/* モバイル: ハンバーガーボタン / デスクトップ: 空 */}
          <div className="md:hidden">
            <MobileNav userEmail={user.email} isAdmin={isAdmin} />
          </div>
          <div className="hidden md:block" />
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <span className="text-sm text-gray-600 dark:text-gray-400">{user.email}</span>
          </div>
        </header>
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  )
}
