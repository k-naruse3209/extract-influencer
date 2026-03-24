'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'

interface NavItem {
  href: string
  label: string
}

interface MobileNavProps {
  userEmail: string
  isAdmin: boolean
}

const mainNavItems: NavItem[] = [
  { href: '/dashboard', label: 'ダッシュボード' },
  { href: '/candidates', label: '候補検索' },
  { href: '/saved', label: '保存済み' },
  { href: '/reports', label: 'レポート' },
  { href: '/settings', label: '設定' },
]

const adminNavItems: NavItem[] = [
  { href: '/admin/users', label: 'ユーザー管理' },
  { href: '/admin/api-keys', label: 'APIキー管理' },
]

/**
 * モバイル向けハンバーガーメニュー + ドロワーナビゲーション。
 * md 以上の画面ではサイドバー側が表示されるため、このコンポーネントは
 * md:hidden で非表示にする。
 */
export function MobileNav({ userEmail, isAdmin }: MobileNavProps) {
  const [isOpen, setIsOpen] = useState(false)
  const drawerRef = useRef<HTMLDivElement>(null)

  function openMenu() {
    setIsOpen(true)
  }

  function closeMenu() {
    setIsOpen(false)
  }

  useEffect(() => {
    if (!isOpen) return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        closeMenu()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  return (
    <>
      {/* ハンバーガーボタン */}
      <button
        type="button"
        onClick={openMenu}
        aria-label="メニューを開く"
        aria-expanded={isOpen}
        className="rounded-md p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
      >
        <svg
          className="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
          />
        </svg>
      </button>

      {/* オーバーレイ + ドロワー */}
      {isOpen && (
        <div className="fixed inset-0 z-40 flex" role="dialog" aria-modal="true">
          {/* 背景オーバーレイ */}
          <div
            className="fixed inset-0 bg-black/50"
            onClick={closeMenu}
            aria-hidden="true"
          />

          {/* ドロワー本体 */}
          <div
            ref={drawerRef}
            className="relative z-50 flex w-72 flex-col bg-white shadow-xl"
          >
            {/* ドロワーヘッダー */}
            <div className="flex h-16 items-center justify-between border-b border-gray-200 px-6">
              <span className="text-sm font-semibold text-gray-900">
                Influencer Platform
              </span>
              <button
                type="button"
                onClick={closeMenu}
                aria-label="メニューを閉じる"
                className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {/* ナビゲーションリンク */}
            <nav className="flex-1 overflow-y-auto p-4">
              <ul className="space-y-1">
                {mainNavItems.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={closeMenu}
                      className="flex items-center rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>

              {isAdmin && (
                <div className="mt-6">
                  <p className="mb-1 px-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
                    管理
                  </p>
                  <ul className="space-y-1">
                    {adminNavItems.map((item) => (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          onClick={closeMenu}
                          className="flex items-center rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        >
                          {item.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </nav>

            {/* ユーザー情報フッター */}
            <div className="border-t border-gray-200 px-6 py-4">
              <p className="truncate text-xs text-gray-500">{userEmail}</p>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
