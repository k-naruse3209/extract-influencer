import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Terms of Service - Influencer Discovery Platform',
  description: '利用規約',
}

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="mb-8 text-3xl font-bold">Terms of Service</h1>
      <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
        Last updated: April 9, 2026
      </p>

      <section className="space-y-6 text-sm leading-relaxed text-gray-700 dark:text-gray-300">
        <div>
          <h2 className="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
            1. Agreement to Terms
          </h2>
          <p>
            By accessing or using the Influencer Discovery Platform (the &quot;Service&quot;)
            operated by DXAI Solutions, Inc. (&quot;Company&quot;, &quot;we&quot;, &quot;us&quot;,
            or &quot;our&quot;), you agree to be bound by these Terms of Service
            (&quot;Terms&quot;). If you do not agree to these Terms, please do not use the Service.
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
            2. Description of Service
          </h2>
          <p>
            The Service provides tools for discovering, analyzing, and comparing Instagram
            influencer accounts. Features include profile data retrieval via the Instagram
            API with Instagram Login, scoring and analysis, candidate comparison, and
            report generation (PDF/CSV).
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
            3. Eligibility
          </h2>
          <p>
            You must be at least 18 years of age and have the legal capacity to enter into
            a binding agreement to use this Service. By using the Service, you represent
            that you meet these requirements.
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
            4. Account Registration
          </h2>
          <p>
            You are responsible for maintaining the confidentiality of your account
            credentials and for all activities that occur under your account. You agree to
            notify us immediately of any unauthorized use of your account.
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
            5. Instagram Integration
          </h2>
          <p className="mb-2">
            The Service integrates with Instagram via the Instagram API with Instagram
            Login. By connecting your Instagram account, you agree to:
          </p>
          <ul className="ml-4 list-disc space-y-1">
            <li>
              Grant the Service permission to access your connected Instagram Business
              or Creator account as described in our Privacy Policy.
            </li>
            <li>
              Comply with{' '}
              <a
                href="https://developers.facebook.com/terms"
                className="text-blue-600 underline dark:text-blue-400"
                target="_blank"
                rel="noopener noreferrer"
              >
                Meta&apos;s Platform Terms
              </a>{' '}
              and{' '}
              <a
                href="https://help.instagram.com/581066165581870"
                className="text-blue-600 underline dark:text-blue-400"
                target="_blank"
                rel="noopener noreferrer"
              >
                Instagram&apos;s Terms of Use
              </a>
              .
            </li>
            <li>
              Use the Service only for legitimate business purposes such as influencer
              marketing research and analysis.
            </li>
          </ul>
        </div>

        <div>
          <h2 className="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
            6. Acceptable Use
          </h2>
          <p className="mb-2">You agree not to use the Service to:</p>
          <ul className="ml-4 list-disc space-y-1">
            <li>Violate any applicable laws or regulations</li>
            <li>Infringe upon the intellectual property rights of others</li>
            <li>Harass, abuse, or harm any individual</li>
            <li>Collect data for spam, phishing, or other malicious purposes</li>
            <li>Circumvent or attempt to circumvent any security measures</li>
            <li>Use the Service in any way that violates Meta Platform Policies</li>
          </ul>
        </div>

        <div>
          <h2 className="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
            7. Intellectual Property
          </h2>
          <p>
            The Service and its original content, features, and functionality are and will
            remain the exclusive property of DXAI Solutions, Inc. and its licensors.
            Reports and analyses generated through the Service are provided for your
            internal business use only.
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
            8. Disclaimer of Warranties
          </h2>
          <p>
            The Service is provided on an &quot;AS IS&quot; and &quot;AS AVAILABLE&quot;
            basis without any warranties of any kind, either express or implied. We do not
            warrant that the Service will be uninterrupted, error-free, or completely
            secure. Influencer analysis results are estimates and should not be relied upon
            as the sole basis for business decisions.
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
            9. Limitation of Liability
          </h2>
          <p>
            To the maximum extent permitted by law, DXAI Solutions, Inc. shall not be
            liable for any indirect, incidental, special, consequential, or punitive
            damages resulting from your use of, or inability to use, the Service.
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
            10. Termination
          </h2>
          <p>
            We reserve the right to terminate or suspend your account at any time, without
            prior notice, for conduct that we believe violates these Terms or is harmful to
            other users, the Service, or third parties.
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
            11. Changes to Terms
          </h2>
          <p>
            We reserve the right to modify these Terms at any time. We will notify users of
            any material changes by updating the &quot;Last updated&quot; date. Continued
            use of the Service after changes constitutes acceptance of the revised Terms.
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
            12. Governing Law
          </h2>
          <p>
            These Terms shall be governed by and construed in accordance with the laws of
            Japan, without regard to its conflict of law provisions.
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
            13. Contact Us
          </h2>
          <p>If you have questions about these Terms, please contact us:</p>
          <p className="mt-2">
            <strong>DXAI Solutions, Inc.</strong> (株式会社DXAIソリューションズ)
            <br />
            Email: legal@dxai-solutions.co.jp
          </p>
        </div>
      </section>
    </main>
  )
}
