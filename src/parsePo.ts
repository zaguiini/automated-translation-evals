import { po } from "gettext-parser";

export interface PoEntry {
  msgid: string;
  msgctxt: string;
  comments: string;
  msgstr: string;
}

export interface PoMetadata {
  language: string;
  projectId: string;
  revisionDate: string;
}

export interface ParsedPo {
  metadata: PoMetadata;
  entries: PoEntry[];
}

function resolveLanguageName(localeCode: string): string {
  const normalized = localeCode.replace("_", "-");
  const displayNames = new Intl.DisplayNames(["en"], { type: "language" });
  const name = displayNames.of(normalized);
  if (!name || name === normalized) {
    throw new Error(`Could not resolve language name for locale code "${localeCode}"`);
  }
  return name;
}

export function parsePo(fileBuffer: Buffer): ParsedPo {
  const parsed = po.parse(fileBuffer);

  const headerMsgstr = parsed.translations[""]?.[""]?.msgstr?.[0] ?? "";

  const languageMatch = headerMsgstr.match(/^Language:\s*(.+)$/m);
  if (!languageMatch?.[1]) {
    throw new Error("PO file is missing the Language header entry");
  }
  const language = resolveLanguageName(languageMatch[1].trim());

  const projectIdMatch = headerMsgstr.match(/^Project-Id-Version:\s*(.+)$/m);
  if (!projectIdMatch?.[1]) {
    throw new Error("PO file is missing the Project-Id-Version header entry");
  }
  const projectId = projectIdMatch[1].trim();

  const revisionDateMatch = headerMsgstr.match(/^PO-Revision-Date:\s*(\S+)/m);
  if (!revisionDateMatch?.[1]) {
    throw new Error("PO file is missing the PO-Revision-Date header entry");
  }
  const revisionDate = revisionDateMatch[1].trim();

  const metadata: PoMetadata = { language, projectId, revisionDate };

  const entries: PoEntry[] = [];

  for (const context of Object.values(parsed.translations)) {
    for (const [msgid, translation] of Object.entries(context)) {
      if (msgid === "") continue;

      const extractedComments = translation.comments?.extracted ?? "";
      const msgctxt = translation.msgctxt ?? "";
      const msgstr = translation.msgstr[0] ?? "";

      entries.push({
        msgid,
        msgctxt,
        comments: extractedComments,
        msgstr,
      });
    }
  }

  return { metadata, entries };
}
