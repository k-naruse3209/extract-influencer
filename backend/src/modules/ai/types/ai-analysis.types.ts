/**
 * AI分析モジュール 共有型定義
 *
 * データ分離原則:
 * - LLM生成コメントは常に dataType: "ESTIMATED" として扱う
 * - 信頼度 (confidence) を必ず付与する
 * - 断定禁止: LLM出力はそのまま事実として扱わない
 */

// ---------------------------------------------------------------------------
// 分析タイプ（Prisma enum と対応）
// ---------------------------------------------------------------------------

export type AnalysisType =
  | 'BRAND_FIT_COMMENT'
  | 'RISK_COMMENT'
  | 'AUDIENCE_INSIGHT'
  | 'CONTENT_STYLE'
  | 'COLLABORATION_SUGGESTION'

// ---------------------------------------------------------------------------
// 入力型
// ---------------------------------------------------------------------------

/**
 * LLMへのプロフィール入力。
 * プロンプト内で事実データと推定データを区別するため、
 * 各フィールドに対応するステータスを添付する。
 */
export interface AnalysisProfileInput {
  username: string
  platform: string
  followerCount: number | null
  followerCountStatus: string
  followingCount: number | null
  engagementRate: number | null
  engagementRateStatus: string
  biography: string | null
  accountType: string | null
}

// ---------------------------------------------------------------------------
// 出力型（基底）
// ---------------------------------------------------------------------------

export interface AnalysisResultBase {
  promptVersion: string
  model: string
  confidence: 'LOW' | 'MEDIUM' | 'HIGH'
}

// ---------------------------------------------------------------------------
// ブランド適合分析結果
// ---------------------------------------------------------------------------

export interface BrandFitAnalysisResult extends AnalysisResultBase {
  score: number
  rationale: string
  strengths: string[]
  concerns: string[]
  recommendation: string
}

// ---------------------------------------------------------------------------
// リスク分析結果
// ---------------------------------------------------------------------------

export interface RiskAnalysisResult extends AnalysisResultBase {
  riskScore: number
  riskFactors: string[]
  positiveFactors: string[]
  overallAssessment: string
}

// ---------------------------------------------------------------------------
// LLMの生JSONレスポンス形状（パース後の検証用）
// ---------------------------------------------------------------------------

export interface BrandFitLlmResponse {
  score: number
  confidence: string
  rationale: string
  strengths: string[]
  concerns: string[]
  recommendation: string
}

export interface RiskLlmResponse {
  riskScore: number
  confidence: string
  riskFactors: string[]
  positiveFactors: string[]
  overallAssessment: string
}
