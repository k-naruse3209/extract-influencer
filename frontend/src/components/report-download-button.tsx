'use client'

import { useState } from 'react'

interface ReportDownloadButtonProps {
  reportId: string
  filename: string
}

/**
 * レポートダウンロードボタン。
 * credentials: 'include' を使って認証付きでバイナリを取得し、
 * ブラウザに a タグ経由でダウンロードさせる。
 */
export function ReportDownloadButton({
  reportId,
  filename,
}: ReportDownloadButtonProps) {
  const [isDownloading, setIsDownloading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  async function handleDownload() {
    setIsDownloading(true)
    setErrorMessage(null)

    try {
      const response = await fetch(
        `/api/v1/reports/${reportId}/download`,
        { credentials: 'include' },
      )

      if (!response.ok) {
        setErrorMessage(`ダウンロードに失敗しました (${response.status})`)
        return
      }

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      setErrorMessage('ダウンロード中にエラーが発生しました。')
    } finally {
      setIsDownloading(false)
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleDownload}
        disabled={isDownloading}
        className="inline-flex items-center rounded-md bg-indigo-600 px-2.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isDownloading ? 'ダウンロード中...' : 'ダウンロード'}
      </button>
      {errorMessage !== null && (
        <p className="mt-1 text-xs text-red-600">{errorMessage}</p>
      )}
    </div>
  )
}
