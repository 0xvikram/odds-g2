// Paper bets settle from Polymarket's result: a winning share pays $1, a losing one $0.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as store from './store'
import { settledMarket } from '../api/_lib'
import { positionsText } from './screens'

const bet = (marketId: string, outcomeIndex: number, stake = 20, entry = 0.4) =>
  store.openPosition({ eventId: 'e1', eventTitle: 'Fed Decision in December?', marketId, label: outcomeIndex ? 'No' : 'Hold', outcomeIndex, stake, entry })

test('a resolved market reports its winner; a closed, unresolved one reports null', () => {
  const won = settledMarket({ id: 1, closed: true, outcomes: '["Up","Down"]', outcomePrices: '["1","0"]', resolutionStatus: 'resolved' })
  assert.equal(won?.winner, 0)
  const pending = settledMarket({ id: 2, closed: true, outcomes: '["Yes","No"]', outcomePrices: '["0.97","0.03"]' })
  assert.equal(pending?.winner, null)
  const disputed = settledMarket({ id: 3, closed: true, outcomes: '["Yes","No"]', outcomePrices: '["0","1"]', resolutionStatus: 'disputed' })
  assert.equal(disputed?.winner, null)
  assert.equal(settledMarket({ id: 4, closed: false, outcomes: '["Yes","No"]', outcomePrices: '["0.5","0.5"]' }), null)
})

test('settling pays $1 a share on a win and $0 on a loss, once', () => {
  const win = bet('m-win', 0) // $20 at 40¢ = 50 shares
  const lose = bet('m-lose', 1, 10, 0.25)
  const keep = bet('m-open', 0)
  const settled = [{ id: 'm-win', winner: 0 }, { id: 'm-lose', winner: 0 }, { id: 'm-open', winner: null }]

  const done = store.settleFrom('e1', settled)
  assert.deepEqual(done.map((p) => [p.id, p.result]).sort(), [[win.id, 'won'], [lose.id, 'lost']].sort())
  assert.equal(store.realized(), 50 - 20 + (0 - 10)) // +30 and -10
  assert.ok(store.awaiting(store.openPositions().find((p) => p.id === keep.id)!, settled))
  assert.equal(store.settleFrom('e1', settled).length, 0) // never settles twice
})

test('positions screen shows open bets, then WON / LOST lines', () => {
  const text = positionsText(store.openPositions(), store.closedPositions(), () => 0.5, (p) => p.marketId === 'm-open', store.realized())
  assert.match(text, /done \+\$20\.00/)
  assert.doesNotMatch(text, /open \+\$0\.00/) // only bet left is waiting for its result
  assert.match(text, /closed, result soon/)
  assert.match(text, /WON Hold \$20 @40¢ \+\$30\.00/)
  assert.match(text, /LOST No \$10 @25¢ -\$10\.00/)
})
