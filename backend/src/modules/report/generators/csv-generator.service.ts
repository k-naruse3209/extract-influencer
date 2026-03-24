import { Injectable, Logger } from '@nestjs/common'
import { stringify } from 'csv-stringify'
import type { ReportProfileData } from '../types/report-profile.data'

/**
 * CsvGeneratorService
 *
 * Converts an array of ReportProfileData into a UTF-8 BOM-prefixed CSV Buffer.
 *
 * Design decisions:
 *   - UTF-8 BOM (\uFEFF) is prepended so Excel auto-detects the encoding.
 *   - Header row includes a "区分" (data-type) column for every metric column
 *     to honour the project data-separation principle.
 *   - csv-stringify handles escaping of commas, newlines and quotes.
 *   - The generator is synchronous internally but returns a Promise so callers
 *     can await it uniformly.
 *
 * NOT responsible for:
 *   - Persisting the file (ReportService owns file I/O)
 *   - Calculating scores (scoring-engineer's domain)
 */
@Injectable()
export class CsvGeneratorService {
  private readonly logger = new Logger(CsvGeneratorService.name)

  /**
   * Build a UTF-8 BOM-prefixed CSV Buffer from the given profile data array.
   */
  async generateCsv(profiles: ReportProfileData[]): Promise<Buffer> {
    const rows = this.buildRows(profiles)

    const csvString = await new Promise<string>((resolve, reject) => {
      stringify(
        rows,
        {
          header: false, // we handle the header row manually in buildRows
          quoted_string: true,
        },
        (err, output) => {
          if (err) {
            reject(err)
          } else {
            resolve(output)
          }
        },
      )
    })

    // Prepend UTF-8 BOM for Excel compatibility
    const bom = '\uFEFF'
    const result = Buffer.from(bom + csvString, 'utf8')

    this.logger.log(
      `CSV generated: ${profiles.length} profiles, ${result.byteLength} bytes`,
    )

    return result
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Build the header row plus one data row per profile.
   *
   * Column layout mirrors the project's data-separation principle:
   * each metric column is immediately followed by a "_区分" column that
   * contains the DataStatus value (FACT / ESTIMATED / UNAVAILABLE).
   */
  private buildRows(profiles: ReportProfileData[]): string[][] {
    const header: string[] = [
      'username',
      'platform',
      'followerCount',
      'followerCount_区分',
      'followingCount',
      'followingCount_区分',
      'engagementRate',
      'engagementRate_区分',
      'mediaCount',
      'mediaCount_区分',
      'totalScore',
      'scoreConfidence',
      'brandFitScore',
      'brandFitScore_区分',
      'riskScore',
      'riskScore_区分',
      'pseudoActivityScore',
      'pseudoActivityScore_区分',
      'engagementScore',
      'engagementScore_区分',
      'growthScore',
      'growthScore_区分',
      'scoringModel',
      'scoredAt',
      'fetchedAt',
    ]

    const dataRows: string[][] = profiles.map((p) => {
      const breakdownMap = this.buildBreakdownMap(p)

      const safeNum = (v: number | null): string =>
        v !== null ? String(v) : ''

      return [
        p.username,
        p.platform,
        safeNum(p.followerCount),
        p.followerCountStatus,
        safeNum(p.followingCount),
        p.followingCountStatus,
        p.engagementRate !== null
          ? String(p.engagementRate)
          : '',
        p.engagementRateStatus,
        safeNum(p.mediaCount),
        p.mediaCountStatus,
        safeNum(p.totalScore),
        p.scoreConfidence ?? '',
        safeNum(breakdownMap['BRAND_FIT']?.score ?? null),
        breakdownMap['BRAND_FIT']?.status ?? '',
        safeNum(breakdownMap['RISK']?.score ?? null),
        breakdownMap['RISK']?.status ?? '',
        safeNum(breakdownMap['PSEUDO_ACTIVITY']?.score ?? null),
        breakdownMap['PSEUDO_ACTIVITY']?.status ?? '',
        safeNum(breakdownMap['ENGAGEMENT']?.score ?? null),
        breakdownMap['ENGAGEMENT']?.status ?? '',
        safeNum(breakdownMap['GROWTH']?.score ?? null),
        breakdownMap['GROWTH']?.status ?? '',
        p.scoringModel ?? '',
        p.scoredAt ? p.scoredAt.toISOString() : '',
        p.fetchedAt ? p.fetchedAt.toISOString() : '',
      ]
    })

    return [header, ...dataRows]
  }

  /**
   * Index the breakdown array by category for O(1) lookup.
   */
  private buildBreakdownMap(
    profile: ReportProfileData,
  ): Record<string, { score: number; status: string }> {
    const map: Record<string, { score: number; status: string }> = {}
    for (const b of profile.breakdowns) {
      map[b.category] = { score: b.score, status: b.status }
    }
    return map
  }
}
