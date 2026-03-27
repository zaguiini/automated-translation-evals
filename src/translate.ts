import OpenAI from "openai";
import { observeOpenAI } from "@langfuse/openai";

export async function translate(prompt: string, model: string, language: string): Promise<string> {
  const messages: OpenAI.ChatCompletionMessageParam[] = [
    {
      role: "system",
      content: `You are a professional translator specializing in ${language} software localization. Respond with only the translated text, nothing else.`,
    },
    { role: "user", content: prompt },
  ];

  const response = await observeOpenAI(new OpenAI()).chat.completions.create({ model, messages });

  const text = response.choices[0]?.message?.content?.trim();
  if (!text) {
    throw new Error(`OpenAI returned empty translation (model=${model})`);
  }

  return text;
}
