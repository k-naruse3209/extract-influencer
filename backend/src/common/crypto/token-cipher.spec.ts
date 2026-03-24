import { describe, it, expect } from 'vitest'
import { encryptToken, decryptToken } from './token-cipher'

const SECRET_HEX = 'a'.repeat(64) // 32バイト hex
const SECRET_UTF8 = 'a'.repeat(32) // 32バイト UTF-8

describe('encryptToken / decryptToken', () => {
  it('暗号化したトークンを正しく復号できる（hex key）', () => {
    const plain = 'IGQWtest_access_token_12345'
    const cipher = encryptToken(plain, SECRET_HEX)
    expect(decryptToken(cipher, SECRET_HEX)).toBe(plain)
  })

  it('暗号化したトークンを正しく復号できる（UTF-8 key）', () => {
    const plain = 'IGQWtest_access_token_abcde'
    const cipher = encryptToken(plain, SECRET_UTF8)
    expect(decryptToken(cipher, SECRET_UTF8)).toBe(plain)
  })

  it('同じ平文でも暗号化するたびに異なる暗号文が生成される（IV ランダム）', () => {
    const plain = 'same_token'
    const c1 = encryptToken(plain, SECRET_HEX)
    const c2 = encryptToken(plain, SECRET_HEX)
    expect(c1).not.toBe(c2)
  })

  it('暗号文フォーマットは iv:authTag:ciphertext の3パートである', () => {
    const cipher = encryptToken('token', SECRET_HEX)
    const parts = cipher.split(':')
    expect(parts).toHaveLength(3)
    expect(parts[0]).toHaveLength(24)  // 12バイト hex
    expect(parts[1]).toHaveLength(32)  // 16バイト hex
  })

  it('異なるキーで復号しようとするとエラーになる', () => {
    const cipher = encryptToken('token', SECRET_HEX)
    const wrongKey = 'b'.repeat(64)
    expect(() => decryptToken(cipher, wrongKey)).toThrow()
  })

  it('暗号文が改ざんされるとエラーになる', () => {
    const cipher = encryptToken('token', SECRET_HEX)
    const parts = cipher.split(':')
    // ciphertext 部分を改ざん
    parts[2] = '00'.repeat(parts[2].length / 2)
    expect(() => decryptToken(parts.join(':'), SECRET_HEX)).toThrow()
  })

  it('不正なフォーマットの暗号文はエラーになる', () => {
    expect(() => decryptToken('invalid', SECRET_HEX)).toThrow('Invalid cipher text format')
  })

  it('キーが32バイト以外の場合はエラーになる', () => {
    expect(() => encryptToken('token', 'short')).toThrow('TOKEN_ENCRYPTION_KEY')
  })
})
