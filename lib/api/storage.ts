export function isValidStoragePath(
  storagePath: string | null | undefined,
  clientId: string,
): boolean {
  if (!storagePath) return true;
  const requiredPrefix = `vault/${clientId}/`;
  if (!storagePath.startsWith(requiredPrefix)) return false;
  if (storagePath.includes("..") || storagePath.includes("\0")) return false;
  return true;
}
