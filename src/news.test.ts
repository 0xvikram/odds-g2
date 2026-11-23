import { test } from 'node:test'
import assert from 'node:assert/strict'
import { newsQuery, parseRss, pickHeadlines } from '../api/_news.ts'

test('query from market titles', () => {
  assert.equal(newsQuery('What price will Bitcoin hit in 2026?'), 'bitcoin')
  assert.equal(newsQuery('Fed Decision in December?'), 'fed decision december')
  assert.equal(newsQuery('UEFA Champions League 2027 Champion'), 'uefa champions league')
})

const xml = `<rss><channel>
<item><title>Bessent Says Fed Risks Overtightening - Bloomberg.com</title><pubDate>Mon, 23 Nov 2026 03:29:00 GMT</pubDate><source url="x">Bloomberg.com</source></item>
<item><title><![CDATA[Traders ditch 50bps December Fed hike bets &amp; more - CoinDesk]]></title><pubDate>Mon, 23 Nov 2026 08:58:32 GMT</pubDate><source url="y">CoinDesk</source></item>
<item><title>Old Fed story - Reuters</title><pubDate>Fri, 20 Nov 2026 08:00:00 GMT</pubDate><source url="z">Reuters</source></item>
<item><title>Celebrity gossip - Daily</title><pubDate>Mon, 23 Nov 2026 09:00:00 GMT</pubDate><source url="w">Daily</source></item>
</channel></rss>`

test('rss parsing strips the source suffix and decodes entities', () => {
  const items = parseRss(xml)
  assert.equal(items.length, 4)
  assert.deepEqual(items[1], { title: 'Traders ditch 50bps December Fed hike bets & more', source: 'CoinDesk', at: Date.parse('Mon, 23 Nov 2026 08:58:32 GMT') })
})

test('only recent headlines that name the market, newest first', () => {
  const now = Date.parse('Mon, 23 Nov 2026 12:00:00 GMT')
  const got = pickHeadlines(parseRss(xml), 'fed decision december', now)
  assert.deepEqual(got.map((h) => h.source), ['CoinDesk', 'Bloomberg.com'])
  assert.deepEqual(pickHeadlines(parseRss(xml), 'bitcoin', now), [])
})
