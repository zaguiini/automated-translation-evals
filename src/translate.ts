import OpenAI from "openai";

const client = new OpenAI();

export async function translate(prompt: string, model: string, language: string): Promise<string> {
  const response = await client.chat.completions.create({
    model,
    messages: [
      {
        role: "system",
        content: `You are a professional translator specializing in ${language} software localization. Respond with only the translated text, nothing else.`,
      },
      { role: "user", content: prompt },
    ],
  });
  const translation = response.choices[0]?.message?.content?.trim();
  if (!translation) {
    throw new Error(`OpenAI returned empty translation (model=${model})`);
  }
  return translation;
}
