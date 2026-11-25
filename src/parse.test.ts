import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parse, matchOutcome, wordsToDigits } from './parse.ts'

test('telegram', () => {
  assert.deepEqual(parse('Connect Telegram.'), { kind: 'telegram' })
  assert.deepEqual(parse('telegram alerts'), { kind: 'telegram' })
  assert.deepEqual(parse('set up telegram'), { kind: 'telegram' })
  assert.deepEqual(parse('open telegram'), { kind: 'telegram' })
  assert.deepEqual(parse('disconnect telegram'), { kind: 'untelegram' })
  assert.deepEqual(parse('stop telegram alerts'), { kind: 'untelegram' })
  assert.deepEqual(parse('follow the fed decision'), { kind: 'follow', query: 'fed decision' })
})

test('number words', () => {
  assert.equal(wordsToDigits('twenty five on hold'), '25 on hold')
  assert.equal(wordsToDigits('a hundred on yes'), '100 on yes')
  assert.equal(wordsToDigits('two hundred fifty on no'), '250 on no')
  assert.equal(wordsToDigits('ten dollars on arsenal'), '10 dollars on arsenal')
})

test('bets', () => {
  assert.deepEqual(parse('$20 on hold'), { kind: 'bet', amount: 20, outcome: 'hold' })
  assert.deepEqual(parse('Twenty dollars on hold.'), { kind: 'bet', amount: 20, outcome: 'hold' })
  assert.deepEqual(parse('Put ten bucks on Arsenal'), { kind: 'bet', amount: 10, outcome: 'arsenal' })
  assert.deepEqual(parse('20 on 25 bps increase'), { kind: 'bet', amount: 20, outcome: '25 bps increase' })
  assert.deepEqual(parse('Bet $5.50 on yes'), { kind: 'bet', amount: 5.5, outcome: 'yes' })
  assert.deepEqual(parse('1,000 on no'), { kind: 'bet', amount: 1000, outcome: 'no' })
})

test('follow', () => {
  assert.deepEqual(parse('Follow the Fed Decision'), { kind: 'follow', query: 'fed decision' })
  assert.deepEqual(parse('Follow the Fed decision in December.'), { kind: 'follow', query: 'fed decision in december' })
  assert.deepEqual(parse("What's bitcoin doing?"), { kind: 'follow', query: 'bitcoin' })
  assert.deepEqual(parse('Watch the Champions League odds'), { kind: 'follow', query: 'champions league' })
})

test('navigation and actions', () => {
  assert.equal(parse('Positions').kind, 'positions')
  assert.equal(parse('show my bets').kind, 'positions')
  assert.equal(parse('Go back.').kind, 'home')
  assert.equal(parse('stop watching').kind, 'unfollow')
  assert.equal(parse('Sell it').kind, 'close')
  assert.equal(parse('Yes, place it').kind, 'yes')
  assert.equal(parse('Yes').kind, 'yes')
  assert.equal(parse('cancel').kind, 'no')
  assert.equal(parse('Why did it move?').kind, 'why')
  assert.equal(parse("What's the news?").kind, 'why')
  assert.deepEqual(parse('alert at 3 percent'), { kind: 'alert', points: 3 })
})

test('silence-like and nonsense never become bets', () => {
  assert.equal(parse('').kind, 'unknown')
  assert.equal(parse('Twenty on.').kind, 'unknown')
  assert.equal(parse('Hey, I am testing if it is working or not.').kind, 'unknown')
})

test('outcome matching', () => {
  const fed = [
    { label: '25 bps increase', outcomes: ['Yes', 'No'] },
    { label: 'No change', outcomes: ['Yes', 'No'] },
    { label: '50+ bps increase', outcomes: ['Yes', 'No'] },
  ]
  assert.deepEqual(matchOutcome('no change', fed), { market: 1, outcome: 0 })
  assert.deepEqual(matchOutcome('25 bps increase', fed), { market: 0, outcome: 0 })
  assert.equal(matchOutcome('arsenal', fed), null)
  const binary = [{ label: 'Yes', outcomes: ['Yes', 'No'] }]
  assert.deepEqual(matchOutcome('no', binary), { market: 0, outcome: 1 })
  assert.deepEqual(matchOutcome('yes', binary), { market: 0, outcome: 0 })
  const ucl = [{ label: 'Arsenal', outcomes: ['Yes', 'No'] }, { label: 'PSG', outcomes: ['Yes', 'No'] }]
  assert.deepEqual(matchOutcome('arsenal', ucl), { market: 0, outcome: 0 })
})
