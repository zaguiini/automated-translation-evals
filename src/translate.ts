import OpenAI from "openai";
import type { PoEntry } from "./parsePo.js";
import { buildPromptContent } from "./uploadPrompts.js";

export async function translate(entry: PoEntry, model: string): Promise<string> {
  const client = new OpenAI();
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
  return response.choices[0].message.content?.trim() ?? "";
}
