import { unloadModel } from '@qvac/sdk'
import { loadEmbedder, loadAnalyst } from './models.mjs'

console.log('Downloading the two model files once (about 1.33 GB). After this, everything runs offline.\n')

for (const load of [loadEmbedder, loadAnalyst]) {
  const modelId = await load()
  process.stderr.write('\n')
  await unloadModel({ modelId, clearStorage: false })
}

console.log('\nModels cached. You are ready for the workshop. Run `npm start` to try it.')
process.exit(0)
