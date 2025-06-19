import * as fs from "fs";
import * as path from "path";
import { generateKeyPair, encryptWithPublicKey, decryptWithPrivateKey, createAuthToken, verifyAuthToken } from "../utils/key_util.js";

// Generate a new key pair and save it to the .keys directory
console.log("test1: outputType = file");
generateKeyPair();

// General encryption/decryption test
const encrypted1 = encryptWithPublicKey("local-test1");
console.log("Encrypted data:", encrypted1);
const decrypted1 = decryptWithPrivateKey(encrypted1);
console.log("Decrypted data:", decrypted1);

// Auth token creation and verification test
const token1 = createAuthToken("local-test1");
console.log("\nAuth token (for Authorization header):");
console.log(`Bearer ${token1}`);
console.log("\nToken length:", token1.length);
try {
  const userId1 = verifyAuthToken(token1);
  console.log("\nVerified user ID:", userId1);
} catch (error) {
  console.error("\nToken verification failed:", error);
}

console.log("test2: outputType = console");
generateKeyPair("console");
const publicKey = fs.readFileSync(path.join(process.cwd(), ".keys", "public_key.pem"), "utf-8");
const privateKey = fs.readFileSync(path.join(process.cwd(), ".keys", "private_key.pem"), "utf-8");

// General encryption/decryption test
const encrypted2 = encryptWithPublicKey("local-test2", { publicKey });
console.log("Encrypted data:", encrypted2);
const decrypted2 = decryptWithPrivateKey(encrypted2, { privateKey });
console.log("Decrypted data:", decrypted2);

// Auth token creation and verification test
const token2 = createAuthToken("local-test2", { publicKey });
console.log("\nAuth token (for Authorization header):");
console.log(`Bearer ${token2}`);
console.log("\nToken length:", token2.length);
try {
  const userId2 = verifyAuthToken(token2, { privateKey });
  console.log("\nVerified user ID:", userId2);
} catch (error) {
  console.error("\nToken verification failed:", error);
}
