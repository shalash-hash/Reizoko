export function resolveMediaFileSize(statSize?: number | null, byteLength?: number | null): number {
  if (statSize != null && statSize > 0) return statSize;
  if (byteLength != null && byteLength > 0) return byteLength;
  return 0;
}
