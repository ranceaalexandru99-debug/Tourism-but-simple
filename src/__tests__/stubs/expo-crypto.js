// Stand-in for expo-crypto, which has no web build: importing the real package
// pulls in expo-modules-core and then React Native, whose Flow syntax vitest
// cannot parse.
//
// The digest is real (Node's crypto), so tests exercise genuine hashing rather
// than a placeholder — what they are checking is the logic around it.
import { createHash, randomUUID as nodeRandomUUID } from "node:crypto";

export const CryptoDigestAlgorithm = { SHA256: "SHA-256", SHA512: "SHA-512" };

export async function digestStringAsync(algorithm, data) {
  const algo = algorithm === CryptoDigestAlgorithm.SHA512 ? "sha512" : "sha256";
  return createHash(algo).update(String(data), "utf8").digest("hex");
}

export const randomUUID = () => nodeRandomUUID();

export function getRandomBytes(n) {
  return Uint8Array.from({ length: n }, () => Math.floor(Math.random() * 256));
}
