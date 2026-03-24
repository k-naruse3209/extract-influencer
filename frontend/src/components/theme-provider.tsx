'use client'

import { useEffect } from 'react'

interface ThemeProviderProps {
  children: React.ReactNode
}

/**
 * ダークモードの初期化を担当するプロバイダー。
 * localStorage の 'theme' キーを読み取り、未設定の場合はシステム設定を尊重する。
 * document.documentElement の 'dark' クラスを追加/削除して Tailwind の class ベース
 * ダークモードを制御する。
 *
 * FOUC 防止のインラインスクリプトは layout.tsx の <head> 内に配置すること。
 */
export function ThemeProvider({ children }: ThemeProviderProps) {
  useEffect(() => {
    const stored = localStorage.getItem('theme')
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches

    if (stored === 'dark' || (stored === null && prefersDark)) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [])

  return <>{children}</>
}
