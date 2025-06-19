import crypto from "node:crypto";
import * as fs from "fs";
import * as path from "path";

const outputKeysDir = path.join(process.cwd(), ".keys");

export const generateKeyPair = (
  outputType: "file" | "console" = "file",
  bits: number = 2048,
) => {
  console.log("Generating RSA key pair...");

  // Generate RSA key pair using Forge
  const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: bits,
    publicKeyEncoding: {
      type: "spki",
      format: "pem",
    },
    privateKeyEncoding: {
      type: "pkcs8",
      format: "pem",
    },
  });
  // Save the keys to files
  if (outputType === "file") {
    if (!fs.existsSync(outputKeysDir)) {
      fs.mkdirSync(outputKeysDir, { recursive: true });
    }
    fs.writeFileSync(path.join(outputKeysDir, "public_key.pem"), publicKey);
    fs.writeFileSync(path.join(outputKeysDir, "private_key.pem"), privateKey);
  }
  console.log("New key pair generated:");
  console.log(
    " - Public key: ",
    outputType === "file"
      ? path.join(outputKeysDir, "public_key.pem")
      : `\n\n${publicKey}\n\n`,
  );
  console.log(
    " - Private key: ",
    outputType === "file"
      ? path.join(outputKeysDir, "private_key.pem")
      : `\n\n${privateKey}\n\n`,
  );
};

export const encryptWithPublicKey = (
  data: string,
  option?: {
    publicKey?: string;
    oaepHash?: string;
    padding?: number;
    encoding?: BufferEncoding;
  },
) => {
  const encryptedData = crypto.publicEncrypt(
    {
      key:
        option?.publicKey ||
        fs.readFileSync(path.join(outputKeysDir, "public_key.pem"), "utf-8"),
      padding: option?.padding || crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: option?.oaepHash || "sha256",
    },
    Buffer.from(data),
  );

  return encryptedData.toString(option?.encoding || "base64");
};

export const decryptWithPrivateKey = (
  encryptedData: string,
  option?: {
    privateKey?: string;
    oaepHash?: string;
    padding?: number;
    encoding?: BufferEncoding;
  },
) => {
  const decryptedData = crypto.privateDecrypt(
    {
      key:
        option?.privateKey ||
        fs.readFileSync(path.join(outputKeysDir, "private_key.pem"), "utf-8"),
      padding: option?.padding || crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: option?.oaepHash || "sha256",
    },
    Buffer.from(encryptedData, option?.encoding || "base64"),
  );

  return decryptedData.toString();
};

export const createAuthToken = (
  userId: string,
  option?: {
    publicKey?: string;
    expiresIn?: number;
  },
) => {
  // Header
  const header = {
    alg: "RSA-OAEP-256",
    typ: "JWT",
  };

  // Payload
  const payload = {
    sub: userId,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (option?.expiresIn || 3600),
  };

  // Encode header and payload to Base64Url
  const headerBase64 = Buffer.from(JSON.stringify(header)).toString(
    "base64url",
  );
  const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString(
    "base64url",
  );

  // Create signature (RSA) using the public key
  const signature = encryptWithPublicKey(`${headerBase64}.${payloadBase64}`, {
    publicKey: option?.publicKey,
    encoding: "base64url",
  });

  // Return the JWT token
  return `${headerBase64}.${payloadBase64}.${signature}`;
};

export const verifyAuthToken = (
  token: string,
  option?: {
    privateKey?: string;
  },
) => {
  try {
    // Split the token into header, payload, and signature
    const [headerBase64, payloadBase64, signature] = token.split(".");

    // Decrypt the signature using the private key
    const decryptedSignature = decryptWithPrivateKey(signature, {
      privateKey: option?.privateKey,
      encoding: "base64url",
    });

    // Verify the signature
    if (decryptedSignature !== `${headerBase64}.${payloadBase64}`) {
      throw new Error("[key_util#verifyAuthToken] Error: Invalid signature");
    }

    // Decode the payload
    const payload = JSON.parse(
      Buffer.from(payloadBase64, "base64url").toString(),
    );

    // Check if the token is expired
    if (payload.exp < Math.floor(Date.now() / 1000)) {
      throw new Error("[key_util#verifyAuthToken] Error: Token expired");
    }

    return payload.sub;
  } catch (error) {
    console.error(
      "[key_util#verifyAuthToken] Error: Token verification failed: ",
      error,
    );
    throw error;
  }
};
