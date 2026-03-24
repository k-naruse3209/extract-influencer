import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy Policy - Influencer Discovery Platform',
  description: 'プライバシーポリシー',
}

export default function PrivacyPolicyPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="mb-8 text-3xl font-bold">Privacy Policy</h1>
      <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
        Last updated: March 24, 2026
      </p>

      <section className="space-y-6 text-sm leading-relaxed text-gray-700 dark:text-gray-300">
        <div>
          <h2 className="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
            1. Introduction
          </h2>
          <p>
            DXAI Solutions, Inc. (&quot;Company&quot;, &quot;we&quot;, &quot;us&quot;, or &quot;our&quot;)
            operates the Influencer Discovery Platform (the &quot;Service&quot;).
            This Privacy Policy explains how we collect, use, disclose, and safeguard
            your information when you use our Service.
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
            2. Information We Collect
          </h2>
          <h3 className="mb-1 font-medium text-gray-800 dark:text-gray-200">
            2.1 Information from Facebook and Instagram
          </h3>
          <p className="mb-2">
            When you connect your Facebook account through Facebook Login, we access
            the following data with your explicit consent:
          </p>
          <ul className="ml-4 list-disc space-y-1">
            <li>
              <strong>instagram_basic</strong>: Basic profile information of Instagram
              Business or Creator accounts linked to your Facebook Pages, including
              username, biography, follower count, following count, and media count.
            </li>
            <li>
              <strong>pages_show_list</strong>: A list of Facebook Pages you manage,
              to identify linked Instagram Business accounts.
            </li>
            <li>
              <strong>pages_read_engagement</strong>: Engagement data from your
              Facebook Pages to support analysis.
            </li>
            <li>
              <strong>business_management</strong>: Access to business assets
              associated with your account.
            </li>
          </ul>

          <h3 className="mb-1 mt-4 font-medium text-gray-800 dark:text-gray-200">
            2.2 Business Discovery Data
          </h3>
          <p>
            We use the Instagram Business Discovery API to retrieve publicly available
            profile information of Instagram Business and Creator accounts for analysis
            purposes. This data includes public profile metrics such as follower count,
            media count, biography, and recent media engagement.
          </p>

          <h3 className="mb-1 mt-4 font-medium text-gray-800 dark:text-gray-200">
            2.3 Account Information
          </h3>
          <p>
            When you create an account, we collect your email address and display name
            for authentication and communication purposes.
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
            3. How We Use Your Information
          </h2>
          <ul className="ml-4 list-disc space-y-1">
            <li>To provide influencer discovery and analysis functionality</li>
            <li>To calculate brand-fit scores, engagement metrics, and risk assessments</li>
            <li>To generate comparison reports (PDF/CSV) for your use</li>
            <li>To maintain and improve the Service</li>
            <li>To authenticate your identity and manage your account</li>
          </ul>
        </div>

        <div>
          <h2 className="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
            4. Data Storage and Security
          </h2>
          <p>
            We take data security seriously. Access tokens obtained through Facebook
            Login are encrypted using AES-256-GCM before storage. We do not store
            plaintext tokens. All data is transmitted over HTTPS. We implement
            role-based access control (RBAC) to limit data access to authorized
            personnel only.
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
            5. Data Sharing
          </h2>
          <p>
            We do not sell, trade, or rent your personal information to third parties.
            We do not share your Facebook or Instagram data with any third party.
            Analysis results are only accessible to authenticated users within your
            organization.
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
            6. Data Retention and Deletion
          </h2>
          <p>
            You may disconnect your Instagram account at any time through the Settings
            page, which will delete your stored access tokens. You may request
            deletion of all your data by contacting us. Upon account deletion, all
            associated data including tokens, profiles, and analysis results will be
            permanently removed.
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
            7. Your Rights
          </h2>
          <p>You have the right to:</p>
          <ul className="ml-4 list-disc space-y-1">
            <li>Access the personal data we hold about you</li>
            <li>Request correction of inaccurate data</li>
            <li>Request deletion of your data</li>
            <li>Withdraw consent for data processing at any time</li>
            <li>Revoke Facebook/Instagram permissions through your Facebook Settings</li>
          </ul>
        </div>

        <div>
          <h2 className="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
            8. Cookies
          </h2>
          <p>
            We use essential cookies for authentication (session management via
            httpOnly secure cookies). We do not use advertising or tracking cookies.
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
            9. Changes to This Policy
          </h2>
          <p>
            We may update this Privacy Policy from time to time. We will notify you of
            any changes by updating the &quot;Last updated&quot; date at the top of
            this page.
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
            10. Contact Us
          </h2>
          <p>
            If you have questions about this Privacy Policy, please contact us:
          </p>
          <p className="mt-2">
            <strong>DXAI Solutions, Inc.</strong> (株式会社DXAIソリューションズ)
            <br />
            Email: privacy@dxai-solutions.co.jp
          </p>
        </div>
      </section>
    </main>
  )
}
