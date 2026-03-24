import Link from 'next/link'

interface SettingItem {
  href: string
  label: string
  description: string
  available: boolean
}

const SETTING_ITEMS: SettingItem[] = [
  {
    href: '/settings/instagram',
    label: 'Instagram 連携',
    description: 'Instagram アカウントを連携してプロフィールデータを取得します',
    available: true,
  },
  {
    href: '/settings/profile',
    label: 'プロフィール',
    description: 'アカウント情報の確認・変更',
    available: false,
  },
]

export default function SettingsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">設定</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          アカウントと連携サービスの設定を管理します
        </p>
      </div>

      <div className="flex flex-col gap-2">
        {SETTING_ITEMS.map((item) =>
          item.available ? (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-5 hover:bg-gray-50 transition-colors dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700"
            >
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{item.label}</p>
                <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{item.description}</p>
              </div>
              <svg
                className="h-5 w-5 text-gray-400 dark:text-gray-500"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
                  clipRule="evenodd"
                />
              </svg>
            </Link>
          ) : (
            <div
              key={item.href}
              className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 p-5 cursor-not-allowed dark:border-gray-700 dark:bg-gray-800"
            >
              <div>
                <p className="text-sm font-medium text-gray-400 dark:text-gray-500">{item.label}</p>
                <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">{item.description}</p>
              </div>
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-400 dark:bg-gray-700 dark:text-gray-500">
                近日公開
              </span>
            </div>
          ),
        )}
      </div>
    </div>
  )
}
