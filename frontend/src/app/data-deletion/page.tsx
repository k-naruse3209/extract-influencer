import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Data Deletion Instructions - Influencer Discovery Platform',
  description: 'データ削除手順',
}

export default function DataDeletionPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="mb-8 text-3xl font-bold">Data Deletion Instructions</h1>
      <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
        Last updated: April 9, 2026
      </p>

      <section className="space-y-6 text-sm leading-relaxed text-gray-700 dark:text-gray-300">
        <div>
          <p>
            This page explains how to request deletion of your data that DXAI Solutions, Inc.
            has collected through the Influencer Discovery Platform via Instagram Login.
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
            What Data We Store
          </h2>
          <ul className="ml-4 list-disc space-y-1">
            <li>Your Instagram access token (encrypted with AES-256-GCM)</li>
            <li>Your connected Instagram account ID and username</li>
            <li>Instagram profile data retrieved via the Instagram API with Instagram Login</li>
          </ul>
        </div>

        <div>
          <h2 className="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
            Option 1: Disconnect via the Service
          </h2>
          <ol className="ml-4 list-decimal space-y-1">
            <li>Log in to the Influencer Discovery Platform</li>
            <li>
              Navigate to <strong>Settings &gt; Instagram Integration</strong>
            </li>
            <li>
              Click <strong>Disconnect</strong>
            </li>
            <li>This will immediately delete your stored access tokens</li>
          </ol>
        </div>

        <div>
          <h2 className="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
            Option 2: Revoke via Meta
          </h2>
          <ol className="ml-4 list-decimal space-y-1">
            <li>
              Go to your{' '}
              <a
                href="https://www.facebook.com/settings?tab=applications"
                className="text-blue-600 underline dark:text-blue-400"
                target="_blank"
                rel="noopener noreferrer"
              >
                Meta Settings &gt; Apps and Websites
              </a>
            </li>
            <li>
              Find <strong>Influencer Discovery Platform</strong> and click{' '}
              <strong>Remove</strong>
            </li>
            <li>This revokes all permissions granted to our app</li>
          </ol>
        </div>

        <div>
          <h2 className="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
            Option 3: Request Full Data Deletion
          </h2>
          <p className="mb-2">
            To request complete deletion of all your data (including analysis results and
            saved candidates), contact us:
          </p>
          <p>
            <strong>Email:</strong> privacy@dxai-solutions.co.jp
            <br />
            Subject: &quot;Data Deletion Request&quot;
            <br />
            Include your registered email address in the request.
          </p>
          <p className="mt-2">
            We will process your request within 30 days and confirm deletion by email.
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
            Contact
          </h2>
          <p>
            <strong>DXAI Solutions, Inc.</strong> (株式会社DXAIソリューションズ)
            <br />
            Email: privacy@dxai-solutions.co.jp
          </p>
        </div>
      </section>
    </main>
  )
}
