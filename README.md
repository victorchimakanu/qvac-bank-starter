# QVAC bank starter: unusual payment finder

Reads a month of a customer's bank transactions, finds the payments that do not fit that
customer, and writes a short analyst note for each one. Everything runs on your own laptop with
[QVAC](https://qvac.tether.io). No API key, no account, no cloud. The transactions never leave the
machine.

## Setup (about 10 minutes, on good wifi)

You need Node.js 22.17 or newer (check with `node -v`) and about 2 GB of free disk.

```
git clone https://github.com/victorchimakanu/qvac-bank-starter.git
cd qvac-bank-starter
npm install
npm run setup
```

`npm run setup` downloads the two model files once (about 1.33 GB). After that, the app works with
the network turned off.

## Run it

```
npm start
```

Or point it at your own file with the same columns as `data/transactions.csv`:

```
npm start -- path/to/your.csv
```

## How it works

1. **Embeddings** (a list of numbers that captures what a piece of text means) are made for every
   payment's merchant and reference, using EmbeddingGemma 300M. A payment whose meaning is far from
   everything else this customer does scores as unusual.
2. **Amount and time** add to the score: amounts far from this customer's typical payment, and
   payments between midnight and 6 in the morning.
3. **A local language model** (Qwen3 1.7B) reads the top payments next to the customer's profile and
   writes a note: risk level, why, and the next step. The output is forced into a fixed JSON shape,
   so your code can trust it.

The sample data is made up. Four payments in it are planted: a large urgent transfer abroad, a
late night casino deposit, ten gift cards bought at 3 in the morning, and a cash withdrawal in
another city.

## Make it yours

Each hackathon track can start from this file:

- **Fraud and AML:** replace the sample CSV with your dataset and tune the three weights in `index.mjs`.
- **Credit and lending:** swap the analyst prompt for an income estimate from the same transactions.
- **Operational efficiency:** feed it call notes or documents instead of payments.
- **Georgian language:** load a Georgian GGUF model in `models.mjs` (for example
  [kona2-small-3.8B](https://huggingface.co/mradermacher/kona2-small-3.8B-GGUF)) by passing its
  Hugging Face URL as `modelSrc`. QVAC runs GGUF files, not safetensors.

Built on `@qvac/sdk` 0.21.1. Docs: [docs.qvac.tether.io](https://docs.qvac.tether.io).
