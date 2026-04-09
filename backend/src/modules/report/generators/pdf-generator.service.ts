import { Injectable, Logger } from '@nestjs/common'
import puppeteer from 'puppeteer'
import type { ReportProfileData } from '../types/report-profile.data'

/**
 * PdfGeneratorService
 *
 * Renders HTML templates to PDF bytes using Puppeteer (headless Chromium).
 * Japanese text is handled via CSS font-family that references system fonts
 * available in the Chromium sandbox; no external font files are required
 * because Puppeteer bundles a Chromium build that includes CJK support.
 *
 * Responsibilities:
 *   - Build HTML strings from profile data
 *   - Convert HTML to PDF Buffer
 *
 * NOT responsible for:
 *   - Persisting the file (ReportService owns file I/O)
 *   - Calculating scores (scoring-engineer's domain)
 *   - Generating LLM comments (brand-fit-analyst / risk-analyst domain)
 */
@Injectable()
export class PdfGeneratorService {
  private readonly logger = new Logger(PdfGeneratorService.name)

  /**
   * Launch a headless Chromium instance, render the HTML, and return the PDF
   * as a Buffer. The browser is closed after each call (no persistent process).
   */
  async generateFromHtml(html: string): Promise<Buffer> {
    const browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
      ],
    })

    try {
      const page = await browser.newPage()
      await page.setContent(html, { waitUntil: 'networkidle0' })

      const pdfUint8Array = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '20mm',
          bottom: '20mm',
          left: '15mm',
          right: '15mm',
        },
      })

      this.logger.log(`PDF generated: ${pdfUint8Array.byteLength} bytes`)
      return Buffer.from(pdfUint8Array)
    } finally {
      await browser.close()
    }
  }

  /**
   * Build the full HTML document for a single-profile report.
   *
   * Data separation is enforced visually:
   *   [FACT]        — confirmed via official API
   *   [ESTIMATED]   — calculated / inferred value
   *   [UNAVAILABLE] — data could not be retrieved
   */
  buildSingleProfileHtml(profile: ReportProfileData): string {
    const generatedAt = new Date().toISOString()
    const profileSection = this.buildProfileSection(profile)
    const scoreSection = this.buildScoreSection(profile)

    return this.wrapHtmlDocument(
      `単体プロフィールレポート: @${profile.username}`,
      `
      ${this.buildHeader(`インフルエンサー詳細レポート`, generatedAt)}
      <h2 style="color:#1a1a2e;border-bottom:2px solid #4a90d9;padding-bottom:8px;">
        @${escapeHtml(profile.username)}
        <span style="font-size:14px;color:#666;margin-left:12px;">${escapeHtml(profile.platform)}</span>
      </h2>
      ${profileSection}
      ${scoreSection}
      ${this.buildDataLegend()}
      ${this.buildDisclaimerSection()}
      ${this.buildFooter(generatedAt)}
      `,
    )
  }

  /**
   * Build the full HTML document for a comparison report (up to 10 profiles).
   */
  buildComparisonHtml(profiles: ReportProfileData[]): string {
    const generatedAt = new Date().toISOString()

    const tableRows = profiles
      .map((p) => this.buildComparisonRow(p))
      .join('\n')

    const detailSections = profiles
      .map((p) => this.buildProfileSection(p) + this.buildScoreSection(p))
      .join('<div style="page-break-before:always;margin-top:24px;"></div>')

    return this.wrapHtmlDocument(
      `比較レポート (${profiles.length}件)`,
      `
      ${this.buildHeader(`インフルエンサー比較レポート (${profiles.length}件)`, generatedAt)}

      <h2 style="color:#1a1a2e;border-bottom:2px solid #4a90d9;padding-bottom:8px;">
        エグゼクティブサマリー
      </h2>
      <table style="${TABLE_STYLE}">
        <thead>
          <tr style="background:#4a90d9;color:#fff;">
            <th style="${TH_STYLE}">ユーザー名</th>
            <th style="${TH_STYLE}">プラットフォーム</th>
            <th style="${TH_STYLE}">フォロワー数</th>
            <th style="${TH_STYLE}">エンゲージメント率</th>
            <th style="${TH_STYLE}">総合スコア</th>
            <th style="${TH_STYLE}">信頼度</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>

      <div style="page-break-before:always;margin-top:24px;"></div>

      <h2 style="color:#1a1a2e;border-bottom:2px solid #4a90d9;padding-bottom:8px;">
        プロフィール詳細
      </h2>
      ${detailSections}

      ${this.buildDataLegend()}
      ${this.buildDisclaimerSection()}
      ${this.buildFooter(generatedAt)}
      `,
    )
  }

  // ---------------------------------------------------------------------------
  // Private HTML builder helpers
  // ---------------------------------------------------------------------------

  private buildComparisonRow(profile: ReportProfileData): string {
    const followerDisplay = formatDataField(
      profile.followerCount?.toLocaleString('ja-JP') ?? null,
      profile.followerCountStatus,
    )
    const engagementDisplay = formatDataField(
      profile.engagementRate !== null
        ? `${(profile.engagementRate * 100).toFixed(2)}%`
        : null,
      profile.engagementRateStatus,
    )
    const score =
      profile.totalScore !== null ? profile.totalScore.toFixed(1) : '—'
    const confidence = profile.scoreConfidence ?? '—'

    return `
      <tr style="border-bottom:1px solid #e0e0e0;">
        <td style="${TD_STYLE}"><strong>@${escapeHtml(profile.username)}</strong></td>
        <td style="${TD_STYLE}">${escapeHtml(profile.platform)}</td>
        <td style="${TD_STYLE}">${followerDisplay}</td>
        <td style="${TD_STYLE}">${engagementDisplay}</td>
        <td style="${TD_STYLE};text-align:center;font-weight:bold;">${escapeHtml(score)}</td>
        <td style="${TD_STYLE};text-align:center;">${escapeHtml(confidence)}</td>
      </tr>
    `
  }

  private buildProfileSection(profile: ReportProfileData): string {
    const followerDisplay = formatDataField(
      profile.followerCount?.toLocaleString('ja-JP') ?? null,
      profile.followerCountStatus,
    )
    const followingDisplay = formatDataField(
      profile.followingCount?.toLocaleString('ja-JP') ?? null,
      profile.followingCountStatus,
    )
    const engagementDisplay = formatDataField(
      profile.engagementRate !== null
        ? `${(profile.engagementRate * 100).toFixed(2)}%`
        : null,
      profile.engagementRateStatus,
    )
    const mediaDisplay = formatDataField(
      profile.mediaCount?.toLocaleString('ja-JP') ?? null,
      profile.mediaCountStatus,
    )
    const fetchedAtDisplay = profile.fetchedAt
      ? profile.fetchedAt.toISOString()
      : '—'

    return `
      <h3 style="color:#2c3e50;margin-top:24px;">プロフィール基本情報</h3>
      <table style="${TABLE_STYLE}">
        <tbody>
          <tr>
            <th style="${TH_LABEL_STYLE}">ユーザー名</th>
            <td style="${TD_STYLE}">@${escapeHtml(profile.username)}</td>
          </tr>
          <tr>
            <th style="${TH_LABEL_STYLE}">表示名</th>
            <td style="${TD_STYLE}">${escapeHtml(profile.displayName ?? '—')}</td>
          </tr>
          <tr>
            <th style="${TH_LABEL_STYLE}">プラットフォーム</th>
            <td style="${TD_STYLE}">${escapeHtml(profile.platform)}</td>
          </tr>
          <tr>
            <th style="${TH_LABEL_STYLE}">プロフィールURL</th>
            <td style="${TD_STYLE}">${escapeHtml(profile.profileUrl ?? '—')}</td>
          </tr>
          <tr>
            <th style="${TH_LABEL_STYLE}">フォロワー数</th>
            <td style="${TD_STYLE}">${followerDisplay}</td>
          </tr>
          <tr>
            <th style="${TH_LABEL_STYLE}">フォロー数</th>
            <td style="${TD_STYLE}">${followingDisplay}</td>
          </tr>
          <tr>
            <th style="${TH_LABEL_STYLE}">エンゲージメント率</th>
            <td style="${TD_STYLE}">${engagementDisplay}</td>
          </tr>
          <tr>
            <th style="${TH_LABEL_STYLE}">投稿数</th>
            <td style="${TD_STYLE}">${mediaDisplay}</td>
          </tr>
          <tr>
            <th style="${TH_LABEL_STYLE}">データ取得日時</th>
            <td style="${TD_STYLE}">${escapeHtml(fetchedAtDisplay)}</td>
          </tr>
        </tbody>
      </table>
    `
  }

  private buildScoreSection(profile: ReportProfileData): string {
    if (profile.totalScore === null) {
      return `
        <h3 style="color:#2c3e50;margin-top:24px;">スコア情報</h3>
        <p style="color:#999;font-style:italic;">スコアデータなし（未算出）</p>
      `
    }

    const breakdownRows = profile.breakdowns
      .map(
        (b) => `
        <tr style="border-bottom:1px solid #e0e0e0;">
          <td style="${TD_STYLE}">${escapeHtml(b.category)}</td>
          <td style="${TD_STYLE};text-align:center;">
            ${buildScoreBar(b.score)}
          </td>
          <td style="${TD_STYLE};text-align:center;">${escapeHtml(b.confidence)}</td>
          <td style="${TD_STYLE};text-align:center;">${buildStatusBadge(b.status)}</td>
          <td style="${TD_STYLE};font-size:12px;color:#555;">${escapeHtml(b.rationale)}</td>
        </tr>
      `,
      )
      .join('\n')

    const scoredAtDisplay = profile.scoredAt
      ? profile.scoredAt.toISOString()
      : '—'

    return `
      <h3 style="color:#2c3e50;margin-top:24px;">スコア詳細</h3>
      <div style="background:#f8f9fa;border-radius:8px;padding:16px;margin-bottom:16px;">
        <div style="font-size:36px;font-weight:bold;color:#4a90d9;text-align:center;">
          ${profile.totalScore.toFixed(1)}<span style="font-size:18px;color:#666;"> / 100</span>
        </div>
        <div style="text-align:center;margin-top:8px;">
          信頼度: <strong>${escapeHtml(profile.scoreConfidence ?? '—')}</strong>
          &nbsp;|&nbsp;
          モデル: <strong>${escapeHtml(profile.scoringModel ?? '—')}</strong>
          &nbsp;|&nbsp;
          算出日時: ${escapeHtml(scoredAtDisplay)}
        </div>
      </div>
      <table style="${TABLE_STYLE}">
        <thead>
          <tr style="background:#4a90d9;color:#fff;">
            <th style="${TH_STYLE}">カテゴリ</th>
            <th style="${TH_STYLE}">スコア</th>
            <th style="${TH_STYLE}">信頼度</th>
            <th style="${TH_STYLE}">データ区分</th>
            <th style="${TH_STYLE}">根拠</th>
          </tr>
        </thead>
        <tbody>
          ${breakdownRows}
        </tbody>
      </table>
    `
  }

  private buildDataLegend(): string {
    return `
      <div style="margin-top:32px;padding:16px;background:#f0f7ff;border-left:4px solid #4a90d9;border-radius:4px;">
        <h4 style="margin:0 0 8px 0;color:#1a1a2e;">データ区分について</h4>
        <ul style="margin:0;padding-left:20px;line-height:2;">
          <li>${buildStatusBadge('FACT')} <strong>公式データ</strong> — Instagram API with Instagram Login より取得した確定値</li>
          <li>${buildStatusBadge('ESTIMATED')} <strong>推定値</strong> — 取得データをもとに計算・推定した値。実際の値と差異が生じる場合があります</li>
          <li>${buildStatusBadge('UNAVAILABLE')} <strong>未取得</strong> — 非公開アカウントやAPI制限により取得不可</li>
        </ul>
      </div>
    `
  }

  private buildDisclaimerSection(): string {
    return `
      <div style="margin-top:24px;padding:16px;background:#fff8e1;border-left:4px solid #ffc107;border-radius:4px;">
        <h4 style="margin:0 0 8px 0;color:#7a6000;">推定値・AI分析についての免責事項</h4>
        <p style="margin:0;font-size:13px;color:#555;line-height:1.7;">
          本レポートに含まれる推定値（ESTIMATED）はアルゴリズムによる計算結果であり、
          実際の数値と差異が生じる場合があります。
          AI分析コメントが含まれる場合は生成AIによる分析であり、事実を断定するものではありません。
          投資・契約判断には公式データおよびご自身の判断をもとにご活用ください。
        </p>
      </div>
    `
  }

  private buildHeader(title: string, generatedAt: string): string {
    return `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;">
        <div>
          <h1 style="margin:0;color:#1a1a2e;font-size:22px;">${escapeHtml(title)}</h1>
          <p style="margin:4px 0 0 0;color:#666;font-size:13px;">
            生成日時: ${escapeHtml(generatedAt)}
          </p>
        </div>
        <div style="text-align:right;font-size:12px;color:#999;">
          Influencer Discovery &amp; Deep Analysis Platform
        </div>
      </div>
    `
  }

  private buildFooter(generatedAt: string): string {
    return `
      <div style="margin-top:40px;padding-top:16px;border-top:1px solid #e0e0e0;font-size:11px;color:#999;text-align:center;">
        Generated by Influencer Discovery &amp; Deep Analysis Platform — ${escapeHtml(generatedAt)}
      </div>
    `
  }

  private wrapHtmlDocument(title: string, body: string): string {
    return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .no-print { display: none; }
    }
    * { box-sizing: border-box; }
    body {
      font-family: "Noto Sans JP", "Hiragino Kaku Gothic ProN", "Hiragino Sans",
                   "BIZ UDGothic", Meiryo, "MS PGothic", sans-serif;
      font-size: 14px;
      color: #1a1a2e;
      line-height: 1.6;
      margin: 0;
      padding: 0;
      background: #fff;
    }
    h1, h2, h3, h4 { font-weight: 700; }
    table { border-collapse: collapse; }
    th, td { vertical-align: top; }
  </style>
</head>
<body>
  ${body}
</body>
</html>`
  }
}

// ---------------------------------------------------------------------------
// Module-private pure helpers
// ---------------------------------------------------------------------------

/** CSS for full-width bordered tables */
const TABLE_STYLE =
  'width:100%;border-collapse:collapse;margin-bottom:16px;font-size:13px;'

/** Styles for column headers in data tables */
const TH_STYLE =
  'padding:10px 12px;text-align:left;font-weight:600;border:1px solid #c8d8f0;'

/** Style for row label cells (left-hand column) */
const TH_LABEL_STYLE =
  'padding:10px 12px;text-align:left;font-weight:600;background:#f0f7ff;border:1px solid #c8d8f0;width:200px;'

/** Style for data cells */
const TD_STYLE = 'padding:10px 12px;border:1px solid #e0e0e0;'

/**
 * Format a nullable value together with its DataStatus badge.
 * Returns "—" wrapped in the UNAVAILABLE badge when value is null.
 */
function formatDataField(value: string | null, status: string): string {
  const badge = buildStatusBadge(status)
  if (value === null || status === 'UNAVAILABLE') {
    return `${badge} —`
  }
  return `${badge} ${escapeHtml(value)}`
}

/**
 * Render a coloured DataStatus badge.
 */
function buildStatusBadge(status: string): string {
  const styles: Record<string, string> = {
    FACT: 'background:#e8f5e9;color:#2e7d32;border:1px solid #a5d6a7;',
    ESTIMATED: 'background:#fff8e1;color:#7a6000;border:1px solid #ffe082;',
    UNAVAILABLE: 'background:#fce4ec;color:#b71c1c;border:1px solid #f48fb1;',
  }
  const labels: Record<string, string> = {
    FACT: '事実',
    ESTIMATED: '推定',
    UNAVAILABLE: '未取得',
  }
  const style =
    styles[status] ?? 'background:#eeeeee;color:#333;border:1px solid #bbb;'
  const label = labels[status] ?? escapeHtml(status)

  return `<span style="display:inline-block;padding:1px 6px;border-radius:3px;font-size:11px;font-weight:600;${style}">${label}</span>`
}

/**
 * Render a simple horizontal score bar followed by the numeric value.
 */
function buildScoreBar(score: number): string {
  const pct = Math.min(100, Math.max(0, score))
  const color = pct >= 70 ? '#43a047' : pct >= 40 ? '#ffa726' : '#e53935'
  return `
    <div style="display:flex;align-items:center;gap:8px;">
      <div style="flex:1;height:8px;background:#e0e0e0;border-radius:4px;overflow:hidden;">
        <div style="width:${pct}%;height:100%;background:${color};border-radius:4px;"></div>
      </div>
      <span style="font-weight:bold;min-width:36px;">${score.toFixed(1)}</span>
    </div>
  `
}

/**
 * Escape characters that are special in HTML to prevent XSS when embedding
 * user-supplied strings (usernames, display names, rationale text, etc.)
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
