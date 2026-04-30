import type { EvalPlugin, FileWriteRecord } from "../types.js";

export function fileWritesFromDiff(
  beforeFiles: Map<string, string> | undefined,
  afterFiles: Map<string, string> | undefined,
  plugin?: EvalPlugin,
): FileWriteRecord[] {
  if (!beforeFiles || !afterFiles) return [];

  const records: FileWriteRecord[] = [];
  for (const [filePath, signature] of [...afterFiles].sort(([a], [b]) => a.localeCompare(b))) {
    if (beforeFiles.get(filePath) === signature) continue;
    const label = plugin?.classifyFile?.(filePath);
    records.push({
      timestamp: 0,
      path: filePath,
      tool: "write",
      labels: label ? [label] : [],
    });
  }
  return records;
}
