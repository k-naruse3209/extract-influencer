import type { SubScoreResult } from '../types/score.types'

/**
 * ブランド適合サブスコアを計算する。
 *
 * LLMスコアがある場合はその値と信頼度を使用する。
 * LLMスコアがない（未取得・エラー）場合は 50 固定 / LOW のフォールバックを返す。
 *
 * 設計上のポイント:
 * - 純粋関数を維持する（AiAnalysisService への依存なし）
 * - LLMの呼び出しと結果保存は ScoreService が行い、
 *   この関数にはスコア値だけを渡す（関心の分離）
 * - スコアは呼び出し元で clamp 済みであることを前提とするが、
 *   安全のため 0〜100 の範囲外をここでもガードする
 *
 * Pure function -- no side-effects.
 */
export function calculateBrandFitScore(
  llmResult?: { score: number; confidence: 'LOW' | 'MEDIUM' | 'HIGH' },
): SubScoreResult {
  if (llmResult !== undefined) {
    const safeScore = Math.max(0, Math.min(100, Math.round(llmResult.score)))

    return {
      score: safeScore,
      confidence: llmResult.confidence,
      status: 'ESTIMATED',
      rationale: `LLM評価によるブランド適合スコア: ${safeScore}/100（信頼度: ${llmResult.confidence}）。LLM生成値は推定値であり断定ではありません。`,
    }
  }

  return {
    score: 50,
    confidence: 'LOW',
    status: 'ESTIMATED',
    rationale:
      'LLMによるブランド適合評価が取得できませんでした。デフォルトのニュートラルスコア 50/100 を返します（フォールバック）。',
  }
}
