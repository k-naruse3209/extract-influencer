import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

/**
 * AES-256-GCM を使ってトークンを暗号化・復号するユーティリティ。
 *
 * 設計方針 (ADR-005):
 * - Instagram アクセストークンは DB に平文保存禁止
 * - secret は process.env.TOKEN_ENCRYPTION_KEY（32バイト hex = 64文字）
 * - 暗号文フォーマット: `<iv_hex>:<authTag_hex>:<ciphertext_hex>`
 *   iv: 12バイト（GCM 推奨）、authTag: 16バイト（GCM デフォルト）
 */

const ALGORITHM = 'aes-256-gcm'
const IV_BYTES = 12
const AUTH_TAG_BYTES = 16
const SEPARATOR = ':'

function deriveKey(secret: string): Buffer {
  // secret は 64文字の hex 文字列（32バイト） または 32バイト生文字列を許容する
  if (secret.length === 64 && /^[0-9a-fA-F]+$/.test(secret)) {
    return Buffer.from(secret, 'hex')
  }
  const buf = Buffer.from(secret, 'utf8')
  if (buf.length !== 32) {
    throw new Error(
      'TOKEN_ENCRYPTION_KEY must be a 32-byte value (64-char hex string or 32-char UTF-8 string)',
    )
  }
  return buf
}

/**
 * plainText を AES-256-GCM で暗号化する。
 *
 * @param plainText 暗号化するトークン文字列
 * @param secret    32バイトの暗号化キー（hex 64文字 or UTF-8 32文字）
 * @returns `<iv_hex>:<authTag_hex>:<ciphertext_hex>` 形式の文字列
 */
export function encryptToken(plainText: string, secret: string): string {
  const key = deriveKey(secret)
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv(ALGORITHM, key, iv)

  const encrypted = Buffer.concat([
    cipher.update(plainText, 'utf8'),
    cipher.final(),
  ])
  const authTag = cipher.getAuthTag()

  return [
    iv.toString('hex'),
    authTag.toString('hex'),
    encrypted.toString('hex'),
  ].join(SEPARATOR)
}

/**
 * encryptToken で暗号化した文字列を復号する。
 *
 * @param cipherText `<iv_hex>:<authTag_hex>:<ciphertext_hex>` 形式の文字列
 * @param secret     暗号化時と同じキー
 * @returns 復号されたトークン文字列
 * @throws 改ざん検知時（authTag 不一致）は crypto モジュールがエラーを投げる
 */
export function decryptToken(cipherText: string, secret: string): string {
  const parts = cipherText.split(SEPARATOR)
  if (parts.length !== 3) {
    throw new Error('Invalid cipher text format')
  }

  const [ivHex, authTagHex, encryptedHex] = parts as [string, string, string]

  if (
    ivHex.length !== IV_BYTES * 2 ||
    authTagHex.length !== AUTH_TAG_BYTES * 2
  ) {
    throw new Error('Invalid cipher text: incorrect iv or authTag length')
  }

  const key = deriveKey(secret)
  const iv = Buffer.from(ivHex, 'hex')
  const authTag = Buffer.from(authTagHex, 'hex')
  const encrypted = Buffer.from(encryptedHex, 'hex')

  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)

  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString(
    'utf8',
  )
}
