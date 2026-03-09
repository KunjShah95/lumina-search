import { Thread } from '../../../main/agents/types'

const SHARE_PREFIX = 'lumina://share/'

function toBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i])
  }

  const base64 = btoa(binary)
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function fromBase64Url(input: string): Uint8Array {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/')
  const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4))
  const binary = atob(normalized + padding)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

export function encodeThreadToShareLink(thread: Thread): string {
  const payload = {
    version: 1,
    exportedAt: Date.now(),
    thread,
  }

  const json = JSON.stringify(payload)
  const bytes = new TextEncoder().encode(json)
  const encoded = toBase64Url(bytes)
  return `${SHARE_PREFIX}${encoded}`
}

export function decodeShareInput(input: string): Thread {
  const trimmed = input.trim()
  const encoded = trimmed.startsWith(SHARE_PREFIX)
    ? trimmed.slice(SHARE_PREFIX.length)
    : trimmed

  if (!encoded) {
    throw new Error('Missing share code payload')
  }

  let decoded: any
  try {
    const bytes = fromBase64Url(encoded)
    decoded = JSON.parse(new TextDecoder().decode(bytes))
  } catch {
    throw new Error('Invalid or corrupted share code')
  }

  if (!decoded?.thread?.id || !decoded?.thread?.title || !Array.isArray(decoded?.thread?.messages)) {
    throw new Error('Share code payload does not contain a valid thread')
  }

  return decoded.thread as Thread
}

export function looksLikeShareInput(input: string): boolean {
  const trimmed = input.trim()
  return trimmed.startsWith(SHARE_PREFIX) || /^[A-Za-z0-9_-]{20,}$/.test(trimmed)
}
