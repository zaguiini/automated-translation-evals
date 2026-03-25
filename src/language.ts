import type { PoMetadata } from "./parsePo.js";

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function resourceName(metadata: PoMetadata): string {
  return `${slugify(metadata.projectId)}-${slugify(metadata.language)}-${metadata.revisionDate}`;
}
