import OpenAI from "openai";

const client = new OpenAI();

export interface TranslationResult {
  text: string;
  usage?: {
    input: number;
    output: number;
    total: number;
  };
}

export async function translate(prompt: string, model: string, language: string): Promise<TranslationResult> {
  const messages: OpenAI.ChatCompletionMessageParam[] = [
    {
      role: "system",
      content: `You are a professional translator specializing in ${language} software localization. Respond with only the translated text, nothing else.`,
    },
    { role: "user", content: prompt },
  ];

  const response = await client.chat.completions.create({ model, messages });

  const text = response.choices[0]?.message?.content?.trim();
  if (!text) {
    throw new Error(`OpenAI returned empty translation (model=${model})`);
  }

  return {
    text,
    usage: response.usage
      ? {
          input: response.usage.prompt_tokens,
          output: response.usage.completion_tokens,
          total: response.usage.total_tokens,
        }
      : undefined,
  };
}
