import { loadModel, EMBEDDINGGEMMA_300M_Q4_0, QWEN3_1_7B_INST_Q4 } from '@qvac/sdk'

const progress = (name) => (p) => process.stderr.write(`\r${name} ${p.percentage.toFixed(0)}%   `)

export async function loadEmbedder () {
  return loadModel({ modelSrc: EMBEDDINGGEMMA_300M_Q4_0, onProgress: progress('EmbeddingGemma 300M (278 MB)') })
}

export async function loadAnalyst () {
  return loadModel({
    modelSrc: QWEN3_1_7B_INST_Q4,
    modelConfig: { ctx_size: 4096 },
    onProgress: progress('Qwen3 1.7B (1.06 GB)')
  })
}
