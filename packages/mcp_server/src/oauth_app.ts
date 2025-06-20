import express from "express";
import { randomUUID } from "node:crypto";
import { ProxyOAuthServerProvider } from "@modelcontextprotocol/sdk/server/auth/providers/proxyProvider.js";
import { getOAuthProtectedResourceMetadataUrl, mcpAuthRouter } from "@modelcontextprotocol/sdk/server/auth/router.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { InMemoryEventStore } from "@modelcontextprotocol/sdk/examples/shared/inMemoryEventStore.js";
import { requireBearerAuth } from "@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js";
import getServer from "./server.js";

// Map to store transports by session ID
const transports: { [sessionId: string]: StreamableHTTPServerTransport } = {};

// const mcpAuthorizationCodeMap: Record<string, string> = {};
// const tokenDataSchema = z.object({
//   access_token: z.string(),
//   token_type: z.string(),
//   expires_in: z.number(),
//   scope: z.string().optional(),
//   refresh_token: z.string().optional(),
//   id_token: z.string().optional(),
//   // Add any other fields you expect from the token response
// });
// type TokenData = z.infer<typeof tokenDataSchema>;
// const mcpAccessTokenMap: Record<string, TokenData> = {};

const getOAuthApp = (isHttpStatefull: boolean) => {
  const app = express();
  app.use(express.json());

  const proxyProvider = new ProxyOAuthServerProvider({
    endpoints: {
      authorizationUrl: process.env.OAUTH_AUTHORIZATION_URL!,
      tokenUrl: process.env.OAUTH_TOKEN_URL!,
      revocationUrl: process.env.OAUTH_REVOCATION_URL!,
      // registrationUrl: process.env.OAUTH_REGISTRATION_URL!,
    },
    verifyAccessToken: async (token) => {
      // debug
      console.log("[mcp_server#verifyAccessToken]Verifying access token:", token);
      return {
        token,
        clientId: process.env.OAUTH_CLIENT_ID!,
        scopes: process.env.OAUTH_SCOPES?.split(",") || [],
      };
    },
    getClient: async (client_id) => {
      // debug
      console.log("[mcp_server#getClient] Getting client information for client_id:", client_id);
      return {
        client_id,
        client_secret: process.env.OAUTH_CLIENT_SECRET!,
        redirect_uris: process.env.OAUTH_MCPSERVER_REDIRECT_URIS?.split(",") || [],
      };
    },
  });

  app.use(
    mcpAuthRouter({
      provider: proxyProvider,
      issuerUrl: new URL(process.env.OAUTH_ISSUER!),
      // baseUrl: new URL("http://localhost:3100"),
      // serviceDocumentationUrl: new URL("https://docs.example.com/"),
    }),
  );

  // debug
  app.use("/", async (req, res, next) => {
    console.log("Received request:", req.method, req.url);
    // Log request headers
    console.log("Request headers:", req.headers);
    // Log request body if present
    if (req.body && Object.keys(req.body).length > 0) {
      console.log("Request body:", req.body);
    } else {
      console.log("No request body");
    }
    console.log("Sending response:", res.headersSent, res.statusCode);
    return next();
  });

  // TODO implement the OAuth flow
  // const codeVerifier = randomBytes(32).toString("base64url");
  // // const codeChallenge = createHash("sha256").update(codeVerifier).digest("base64url");
  // app.get("/oauth/callback", async (req, res, next) => {
  //   console.log("Received OAuth callback request: ", req.query);
  //   const { code, state } = req.query;
  //   if (!code || !state) {
  //     console.error("Missing code or state in OAuth callback");
  //     res.status(400).json({
  //       jsonrpc: "2.0",
  //       error: {
  //         code: -32000,
  //         message: "Bad Request: Missing code or state",
  //       },
  //       id: null,
  //     });
  //     return next();
  //   }

  //   // TODO
  //   // You need to validate the state here.

  //   // Add the logic to send the code to the third-party OAuth provider and retrieve the token using fetch.
  //   const tokenRes = await fetch(process.env.OAUTH_TOKEN_URL!, {
  //     method: "POST",
  //     headers: {
  //       "Content-Type": "application/x-www-form-urlencoded",
  //     },
  //     body: new URLSearchParams({
  //       grant_type: "authorization_code",
  //       code: code as string,
  //       redirect_uri: req.url,
  //       client_id: process.env.OAUTH_CLIENT_ID!,
  //       client_secret: process.env.OAUTH_CLIENT_SECRET!,
  //       code_verifier: codeVerifier,
  //     }).toString(),
  //   });
  //   if (!tokenRes.ok) {
  //     console.error("Failed to exchange code for token:", tokenRes.status, tokenRes.statusText);
  //     res.status(500).json({
  //       jsonrpc: "2.0",
  //       error: {
  //         code: -32000,
  //         message: "Internal Server Error: Failed to exchange code for token",
  //       },
  //       id: null,
  //     });
  //     return next();
  //   }
  //   const tokenData = tokenDataSchema.parse(await tokenRes.json());
  //   console.log("Token data received:", tokenData);

  //   // Make MCP access token and authorization code
  //   const mcpAccessToken = randomBytes(32).toString("base64url");
  //   const mcpAuthorizationCode = randomBytes(16).toString("base64url");

  //   // Store the mapping of MCP authorization code to access token
  //   mcpAuthorizationCodeMap[mcpAuthorizationCode] = mcpAccessToken;
  //   mcpAccessTokenMap[mcpAccessToken] = tokenData;

  //   // debug
  //   console.log("Generated MCP access token and authorization code:", {
  //     mcpAccessToken,
  //     mcpAuthorizationCode,
  //   });
  //   res.redirect(`${process.env.OAUTH_MCPCLIENT_REDIRECT_URIS!}?mcp_authorization_code=${encodeURIComponent(mcpAuthorizationCode)}`);
  // });

  const bearerAuthMiddleware = requireBearerAuth({
    verifier: proxyProvider,
    requiredScopes: process.env.OAUTH_SCOPES?.split(",") || [],
    resourceMetadataUrl: getOAuthProtectedResourceMetadataUrl(new URL("/mcp", process.env.OAUTH_ISSUER!)),
  });

  // POST request handler for the Streamable HTTP transport
  app.post("/mcp", bearerAuthMiddleware, async (req, res, next) => {
    console.log("Received POST MCP request:", req.body);
    try {
      // クライアント側で処理すべきで、MCPサーバでは401返すのみ
      // if (!req.headers.authorization) {
      //   const redirectUrl = `/authorize?response_type=code&client_id=${process.env.OAUTH_CLIENT_ID!}&redirect_uri=${process.env.OAUTH_MCPSERVER_REDIRECT_URIS?.split(",")[0]}&code_challenge=${codeChallenge}&code_challenge_method=S256&state=1234567890`;
      //   console.log("Redirecting to OAuth authorization URL:", redirectUrl);
      //   return res.redirect(redirectUrl);
      // }

      let transport: StreamableHTTPServerTransport;
      if (isHttpStatefull) {
        const sessionId = req.headers["mcp-session-id"] as string | undefined;
        if (sessionId && transports[sessionId]) {
          transport = transports[sessionId];
          // debug
          console.log("Found existing transport for session ID:", sessionId);
        } else if (!sessionId && isInitializeRequest(req.body)) {
          transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: () => randomUUID(),
            eventStore: new InMemoryEventStore(),
            onsessioninitialized: (sessionId) => {
              transports[sessionId] = transport;
              // debug
              console.log("Session initialized:", sessionId);
            },
          });
          transport.onclose = () => {
            if (transport.sessionId) {
              delete transports[transport.sessionId];
              // debug
              console.log("Session closed:", transport.sessionId);
            }
          };

          const server = getServer();
          await server.connect(transport);
          // debug
          console.log("Created new transport for session ID:", transport.sessionId);
        } else {
          // Invalid request
          res.status(400).json({
            jsonrpc: "2.0",
            error: {
              code: -32000,
              message: "Bad Request: No valid session ID provided",
            },
            id: null,
          });
          return next();
        }
      } else {
        const server = getServer();
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: undefined,
        });
        res.on("close", () => {
          console.log("MCP request closed");
          transport.close();
          server.close();
        });
        await server.connect(transport);
        // debug
        console.log("Created new transport for stateless request");
      }

      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      console.error("Error handling MCP request:", error);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: {
            code: -32603,
            message: "Internal server error",
          },
          id: null,
        });
      }
    }
  });

  // app.post("/register", async (req, res) => {
  //   console.log("Received POST Dynamic client registration request:", req.body);
  //   res.status(201).json({
  //     client_id: process.env.OAUTH_CLIENT_ID!,
  //     client_secret: process.env.OAUTH_CLIENT_SECRET!,
  //     redirect_uris: process.env.OAUTH_MCPSERVER_REDIRECT_URIS?.split(",") || [],
  //   });
  // });

  app.get("/mcp", async (req, res) => {
    console.log("Received GET MCP request");
    res.writeHead(405).end(
      JSON.stringify({
        jsonrpc: "2.0",
        error: {
          code: -32000,
          message: "Method not allowed.",
        },
        id: null,
      }),
    );
  });

  app.delete("/mcp", async (req, res) => {
    console.log("Received DELETE MCP request");
    if (!isHttpStatefull) {
      res.writeHead(405).end(
        JSON.stringify({
          jsonrpc: "2.0",
          error: {
            code: -32000,
            message: "Method not allowed.",
          },
          id: null,
        }),
      );
      return;
    }

    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    if (!sessionId || !transports[sessionId]) {
      res.status(400).json({
        jsonrpc: "2.0",
        error: {
          code: -32000,
          message: "Bad Request: No valid session ID provided",
        },
        id: null,
      });
      return;
    }

    console.log("Closing transport for session ID:", sessionId);

    try {
      const transport = transports[sessionId];
      await transport.handleRequest(req, res);
      console.log("Transport closed for session ID:", sessionId);
    } catch (error) {
      console.error("Error closing transport:", error);
      if (!res.headersSent) {
        res.status(500).send("Error closing transport");
      }
    }
  });

  return app;
};

export default getOAuthApp;
