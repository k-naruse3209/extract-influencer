'use client'

interface GlobalErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

/**
 * ルートレイアウト自体のエラー用 fallback。
 * layout.tsx が壊れた場合に表示されるため、html/body を自前で持ち
 * Tailwind に依存しないインラインスタイルを使う。
 */
export default function RootLayoutError({ error, reset }: GlobalErrorProps) {
  return (
    <html lang="ja">
      <body
        style={{
          margin: 0,
          fontFamily: 'sans-serif',
          backgroundColor: '#f9fafb',
          display: 'flex',
          minHeight: '100vh',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: '448px',
            backgroundColor: '#ffffff',
            border: '1px solid #fecaca',
            borderRadius: '8px',
            padding: '32px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          }}
        >
          <h1
            style={{
              fontSize: '20px',
              fontWeight: 700,
              color: '#111827',
              margin: '0 0 8px',
            }}
          >
            アプリケーションエラー
          </h1>
          <p style={{ fontSize: '14px', color: '#b91c1c', margin: '0 0 4px' }}>
            {error.message}
          </p>
          {error.digest !== undefined && (
            <p style={{ fontSize: '12px', color: '#9ca3af', margin: '0 0 24px' }}>
              エラーID: {error.digest}
            </p>
          )}
          <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
            <button
              type="button"
              onClick={reset}
              style={{
                backgroundColor: '#4f46e5',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                padding: '8px 16px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                outline: '2px solid transparent',
                outlineOffset: '2px',
              }}
              onFocus={(e) => {
                e.currentTarget.style.outline = '2px solid #4f46e5'
                e.currentTarget.style.outlineOffset = '2px'
              }}
              onBlur={(e) => {
                e.currentTarget.style.outline = '2px solid transparent'
              }}
            >
              再試行
            </button>
            <a
              href="/"
              style={{
                backgroundColor: '#ffffff',
                color: '#374151',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                padding: '8px 16px',
                fontSize: '14px',
                fontWeight: 500,
                textDecoration: 'none',
                display: 'inline-block',
              }}
            >
              ホームへ戻る
            </a>
          </div>
        </div>
      </body>
    </html>
  )
}
