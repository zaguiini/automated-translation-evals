import OpenAI from "openai";
import type { PoEntry } from "./parsePo.js";
import { buildPromptContent } from "./uploadPrompts.js";

const client = new OpenAI();

export async function translate(entry: PoEntry, model: string): Promise<string> {
  const response = await client.chat.completions.create({
    model,
    messages: [
      {
        role: "system",
        content: "You are a professional translator specializing in Brazilian Portuguese software localization. Respond with only the translated text, nothing else.",
      },
      { role: "user", content: buildPromptContent(entry) },
    ],
  });
  const translation = response.choices[0]?.message?.content?.trim();
  if (!translation) {
    throw new Error(`OpenAI returned empty translation (model=${model})`);
  }
  return translation;
}
