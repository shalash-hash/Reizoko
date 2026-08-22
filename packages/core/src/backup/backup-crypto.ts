export async function sha256Hex(data: Uint8Array): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new Uint8Array(data));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}
