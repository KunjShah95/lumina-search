import { describe, expect, it } from 'vitest'
import { encodeThreadToShareLink, decodeShareInput, looksLikeShareInput } from '../src/renderer/src/utils/shareCode'
import { Thread } from '../src/main/agents/types'

describe('share code utilities', () => {
  const sampleThread: Thread = {
    id: 'thread_123',
    title: 'What is TypeScript?',
    createdAt: Date.now() - 1000,
    updatedAt: Date.now(),
    messages: [
      { role: 'user', content: 'What is TypeScript?' },
      { role: 'assistant', content: 'TypeScript is a typed superset of JavaScript.' },
    ],
    sources: [
      {
        url: 'https://www.typescriptlang.org/docs/',
        title: 'TypeScript Docs',
        snippet: 'Official documentation',
        domain: 'typescriptlang.org',
        link: 'https://www.typescriptlang.org/docs/',
        source: 'web',
      },
    ],
  }

  it('encodes and decodes a thread round-trip', () => {
    const link = encodeThreadToShareLink(sampleThread)
    expect(link.startsWith('lumina://share/')).toBe(true)

    const decoded = decodeShareInput(link)
    expect(decoded.id).toBe(sampleThread.id)
    expect(decoded.title).toBe(sampleThread.title)
    expect(decoded.messages.length).toBe(2)
  })

  it('accepts raw payloads and prefixed links', () => {
    const link = encodeThreadToShareLink(sampleThread)
    const raw = link.replace('lumina://share/', '')

    expect(decodeShareInput(raw).id).toBe(sampleThread.id)
    expect(looksLikeShareInput(link)).toBe(true)
    expect(looksLikeShareInput(raw)).toBe(true)
  })

  it('throws on invalid payload', () => {
    expect(() => decodeShareInput('lumina://share/not-a-real-payload')).toThrow()
  })
})
