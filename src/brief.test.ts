// "Since you last looked": one row per moved market, and a readable age for the header.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { briefRow, since } from './screens'

test('brief row shows from → to and the move in points', () => {
  assert.equal(briefRow('Fed Decision in December?', '25 bps increase', 0.88, 0.92), 'Fed Decision in Dec…: 25 bps incr… 88%→92% ▲4')
  assert.match(briefRow('What price will Bitcoin hit in 2026?', '↓ 55,000', 0.68, 0.62), /68%→62% ▼6$/)
  assert.ok(briefRow('A very long market title that keeps going and going', 'A long outcome label', 0.1, 0.5).length <= 62)
})

test('since() reads like a person would say it', () => {
  const now = Date.UTC(2026, 10, 27, 12)
  assert.equal(since(now - 5 * 60000, now), '5m ago')
  assert.equal(since(now - 3 * 3600000, now), '3h ago')
  assert.equal(since(now - 3 * 86400000, now), '3d ago')
})
