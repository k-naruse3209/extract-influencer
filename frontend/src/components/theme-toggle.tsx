'use client'

import { useEffect, useState } from 'react'

type Theme = 'light' | 'dark'

/**
 * ライト / ダークモードを切り替えるトグルボタン。
 * - 初期値: localStorage の 'theme' キー → システム設定の順で決定する
 * - 選択はlocalStorageの 'theme' キーに永続化する
 * - アイコンはテキスト（sun: ☀ / moon: ☽）で表現する
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('light')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem('theme')
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const initial: Theme =
      stored === 'dark' ? 'dark' : stored === 'light' ? 'light' : prefersDark ? 'dark' : 'light'
    setTheme(initial)
    setMounted(true)
  }, [])

  function toggle() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    localStorage.setItem('theme', next)
    if (next === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }

  if (!mounted) {
    return (
      <button
        type="button"
        aria-label="テーマを切り替える"
        className="rounded-md p-2 text-gray-500 opacity-0"
        disabled
      >
        ☀
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={theme === 'dark' ? 'ライトモードに切り替える' : 'ダークモードに切り替える'}
      title={theme === 'dark' ? 'ライトモードに切り替える' : 'ダークモードに切り替える'}
      className="rounded-md p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-100"
    >
      {theme === 'dark' ? '☀' : '☽'}
    </button>
  )
}
