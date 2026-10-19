import { readFileSync } from 'node:fs'
import { embed, completion, unloadModel } from '@qvac/sdk'
import { loadEmbedder, loadAnalyst } from './models.mjs'

const FILE = process.argv[2] || new URL('./data/transactions.csv', import.meta.url)
const TOP = Number(process.env.TOP ?? 4)

const [header, ...lines] = readFileSync(FILE, 'utf8').trim().split('\n')
const cols = header.split(',')
const rows = lines.map((line) => Object.fromEntries(line.split(',').map((v, i) => [cols[i], v.trim()])))
const spend = rows.filter((r) => r.direction === 'out')

const t0 = Date.now()
console.log(`Read ${rows.length} transactions from ${FILE instanceof URL ? 'data/transactions.csv' : FILE}. Loading models from disk...`)
const embedderId = await loadEmbedder()
const analystId = await loadAnalyst()
process.stderr.write('\n')
console.log(`Models ready in ${((Date.now() - t0) / 1000).toFixed(1)}s. Nothing below leaves this machine.\n`)

const texts = spend.map((r) => `${r.merchant}. ${r.reference}. Paid by ${r.channel}.`)
const { embedding: vectors } = await embed({ modelId: embedderId, text: texts })

const cosine = (a, b) => {
  let dot = 0, na = 0, nb = 0
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i] }
  return dot / Math.sqrt(na * nb)
}
const median = (xs) => { const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2 }
const scale = (xs) => { const max = Math.max(...xs) || 1; return xs.map((x) => x / max) }

const novelty = vectors.map((v, i) => 1 - Math.max(...vectors.map((w, j) => (i === j ? -1 : cosine(v, w)))))
const logAmounts = spend.map((r) => Math.log(Number(r.amount_gel)))
const mid = median(logAmounts)
const mad = median(logAmounts.map((x) => Math.abs(x - mid))) * 1.4826 || 1
const amountOdd = logAmounts.map((x) => Math.abs(x - mid) / mad)
const night = spend.map((r) => (Number(r.time.slice(0, 2)) < 6 ? 1 : 0))

const [nov, amt] = [scale(novelty), scale(amountOdd)]
const scored = spend
  .map((r, i) => ({ ...r, score: 0.5 * nov[i] + 0.35 * amt[i] + 0.15 * night[i], why: { novelty: nov[i], amount: amt[i], night: night[i] } }))
  .sort((a, b) => b.score - a.score)

console.log('Most unusual payments for this customer:')
for (const r of scored.slice(0, TOP)) {
  console.log(`  ${r.score.toFixed(2)}  ${r.date} ${r.time}  ${r.amount_gel} GEL  ${r.merchant} (${r.reference})`)
}

const usual = Object.entries(spend.reduce((acc, r) => ({ ...acc, [r.merchant]: (acc[r.merchant] ?? 0) + 1 }), {}))
  .sort((a, b) => b[1] - a[1]).slice(0, 6).map(([m, n]) => `${m} (${n} times)`).join(', ')
const profile = `Monthly salary about ${rows.find((r) => r.direction === 'in')?.amount_gel ?? 'unknown'} GEL. ` +
  `Typical payment ${Math.exp(mid).toFixed(2)} GEL. Usual merchants: ${usual}.`

const NOTE_SCHEMA = {
  type: 'object',
  properties: {
    risk: { type: 'string', enum: ['low', 'medium', 'high'] },
    reason: { type: 'string' },
    next_step: { type: 'string' }
  },
  required: ['risk', 'reason', 'next_step'],
  additionalProperties: false
}

console.log('\nAnalyst notes, written on this machine:\n')
for (const r of scored.slice(0, TOP)) {
  const started = Date.now()
  const run = completion({
    modelId: analystId,
    history: [
      {
        role: 'system',
        content: 'You are a fraud analyst at a retail bank. Judge one payment against the customer profile. ' +
          'Rent, bills and salary are normal even when large. Be short and concrete. /no_think'
      },
      {
        role: 'user',
        content: `Customer profile: ${profile}\nPayment: ${r.date} at ${r.time}, ${r.amount_gel} GEL to ${r.merchant}, reference "${r.reference}", by ${r.channel}.`
      }
    ],
    stream: true,
    responseFormat: { type: 'json_schema', json_schema: { name: 'analyst_note', schema: NOTE_SCHEMA } }
  })
  for await (const _ of run.events);
  const final = await run.final
  const note = JSON.parse(final.contentText.trim())
  console.log(`${r.merchant}, ${r.amount_gel} GEL: ${note.risk.toUpperCase()} risk`)
  console.log(`  Why: ${note.reason}`)
  console.log(`  Next: ${note.next_step}`)
  console.log(`  (${((Date.now() - started) / 1000).toFixed(1)}s)\n`)
}

await unloadModel({ modelId: embedderId, clearStorage: false })
await unloadModel({ modelId: analystId, clearStorage: false })
process.exit(0)
