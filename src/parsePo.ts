import { po } from "gettext-parser";

export interface PoEntry {
  msgid: string;
  msgctxt: string;
  comments: string;
  msgstr: string;
}

export function parsePo(fileBuffer: Buffer): PoEntry[] {
  const parsed = po.parse(fileBuffer);
  const entries: PoEntry[] = [];

  for (const context of Object.values(parsed.translations)) {
    for (const [msgid, translation] of Object.entries(context)) {
      // Skip the header entry
      if (msgid === "") continue;

      const extractedComments = translation.comments?.extracted ?? "";
      const msgctxt = translation.msgctxt ?? "";
      const msgstr = Array.isArray(translation.msgstr)
        ? translation.msgstr[0]
        : translation.msgstr ?? "";

      entries.push({
        msgid,
        msgctxt,
        comments: extractedComments,
        msgstr,
      });
    }
  }

  return entries;
}
