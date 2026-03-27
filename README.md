# Automated Translation Evals

Checks how accurate an AI model can generate translations compared to a human translation baseline.

Useful for delegating future translations of a known language to AI for speed or human scarcity.

It uses two evaluation methods:
- chrF: character-level F-score (local evaluator)
- LLM-as-Judge: accuracy evaluation using a LLM as a judge (online evaluator)

## Workflow

Follow these steps in sequence.

### Get a PO file

1. Enter the project in GlotPress (https://translate.wordpress.com/projects/woocommerce/woocommerce-ios/)
2. Choose a language
3. Scroll and click "Export", verify that the PO format is selected

This is not specific to Automattic's projects. Any PO file can be used as long as it has the following headers:

- Language: `<language>`
- Project-Id-Version: `<project-id>`
- PO-Revision-Date: `<revision-date>`

### Upload the AI translation prompt

```
npm run upload-prompt
```

This is the reference prompt used to generate the AI translations for each dataset item. You can see it in the [uploadPrompts](./src/uploadPrompts.ts) file.

### Upload the original and human translations dataset

```
npm run upload-dataset -- <po-file> [--limit N]
```

This is the dataset of strings to translate. The human translations are uploaded as baseline dataset in Langfuse.

### Configure the accuracy evaluator (LLM-as-Judge)

Enter Langfuse and navigate to the project. Go to LLM-as-Judge section and click "Setup evaluator".

Setup the default model if not done already, then create the new evaluator with the following settings...

#### Base prompt

```
You are evaluating a {{language}} translation of an English UI string.

## Original English
{{source}}

## Context (identifier)
{{context}}

## Developer comments
{{comments}}

## Human reference translation
{{reference}}

## AI translation to evaluate
{{hypothesis}}
```

#### Score type

`Numeric`

#### Score reasoning prompt

`Determine the accuracy of the translation. How faithfully does it convey the meaning of the English source. One sentence only.`

#### Score output prompt

`Score between 0 and 1, with four decimal places.`

Once that's done, configure the evaluator to run on "Experiments" and map the following variables:

- `language`: Metadata. Path: `$.language`
- `source`: Input. Path: `$.msgid`
- `context`: Input. Path: `$.msgctxt`
- `comments`: Input. Path: `$.comments`
- `reference`: Expected output.
- `hypothesis`: Output.

Click "Execute". Once that's done, you can run the evaluations.

### Run evaluations

```
npm run eval -- <po-file> --model <model> [--limit N]
```

## Visualization

Within LangFuse:

Datasets > Dataset > Select runs > Compare

## Evaluation methods breakdown

### chrF (algorithmic local evaluator)

Measures character-level overlap using character n-grams (orders 1–6). Computes an F-score with recall-weighted averaging (β=2). Handles morphologically rich languages and minor spelling differences well. Score range: 0–1. Computed locally as an inline evaluator during the experiment run.

### Accuracy (LLM-as-Judge online evaluator)

Uses Claude as an online evaluator during the experiment run to rate how faithfully the translation conveys the meaning of the original English string. The judge considers the source text, any developer comments, and the reference translation. Score range: 0–1.
