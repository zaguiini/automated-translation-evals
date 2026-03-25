# Automated Translation Evals

## How to get the PO file

1. Enter the project in GlotPress (https://translate.wordpress.com/projects/woocommerce/woocommerce-ios/)
2. Choose a language
3. Scroll and click "Export", verify that .po is selected

## CLI Workflow

Follow these steps in sequence.

Upload prompt:

```
npm run upload-prompt -- <po-file>
```

Upload dataset:

```
npm run upload-dataset -- <po-file> [--limit N]
```

Run evaluations:

```
npm run eval -- <po-file> --model <model> [--limit N]
```

## Visualization

Within LangFuse:

Datasets > Dataset > Select runs > Compare

## How the evaluation methods work

### chrF

Measures character-level overlap using character n-grams (orders 1–6). Computes an F-score with recall-weighted averaging (β=2). Handles morphologically rich languages and minor spelling differences well. Score range: 0–1.

### Accuracy (LLM-as-Judge)

Uses Claude as an evaluator to rate how faithfully the translation conveys the meaning of the original English string. The judge considers the source text, any developer comments, and the reference translation. Score range: 0–1.

### Fluency (LLM-as-Judge)

Uses Claude as an evaluator to rate how natural and idiomatic the translation sounds to a native speaker, independent of the reference. Score range: 0–1.
