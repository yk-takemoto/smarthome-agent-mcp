import express from "express";
import { randomUUID } from "node:crypto";
import { ProxyOAuthServerProvider } from "@modelcontextprotocol/sdk/server/auth/providers/proxyProvider.js";
import { mcpAuthRouter } from "@modelcontextprotocol/sdk/server/auth/router.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { InMemoryEventStore } from "@modelcontextprotocol/sdk/examples/shared/inMemoryEventStore.js";
import { requireBearerAuth } from "@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js";
import getServer from "./server.js";
import { verifyAuthToken } from "./utils/key_util.js";

// Map to store transports by session ID
const transports: { [sessionId: string]: StreamableHTTPServerTransport } = {};

// TODO : Implement a proper user ID validation function
const isValidUserId = (__userId: string): boolean => {
  // Implement your user ID validation logic here
  // For example, check if the user ID exists in your database
  return true; // Placeholder implementation
};

const getHttpApp = (isHttpStatefull: boolean) => {
  const app = express();
  app.use(express.json());

  const proxyProvider = new ProxyOAuthServerProvider({
    endpoints: {
      authorizationUrl: "http://localhost:3100",
      tokenUrl: "http://localhost:3100",
    },
    verifyAccessToken: async (token) => {
      // Check if the token is provided
      const userId = verifyAuthToken(token);
      // debug
      console.log("[mcp_server#verifyAccessToken] Verified user ID from token:", userId);
      if (!userId || !isValidUserId(userId)) {
        throw new Error("[mcp_server#verifyAccessToken] Error: Invalid access token");
      }

      return {
        token,
        clientId: "",
        scopes: [],
      };
    },
    getClient: async (client_id) => {
      // debug
      console.log("[mcp_server#getClient] Getting client information for client_id:", client_id);
      return {
        client_id,
        redirect_uris: [],
      };
    },
  });

  const bearerAuthMiddleware = requireBearerAuth({
    provider: proxyProvider,
  });

  // Generate a code challenge for PKCE
  app.use(
    mcpAuthRouter({
      provider: proxyProvider,
      issuerUrl: new URL("http://localhost:3100"),
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

  // POST request handler for the Streamable HTTP transport
  app.post("/mcp", bearerAuthMiddleware, async (req, res, next) => {
    console.log("Received POST MCP request:", req.body);
    try {
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

  app.get("/mcp", bearerAuthMiddleware, async (req, res) => {
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

  app.delete("/mcp", bearerAuthMiddleware, async (req, res) => {
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

export default getHttpApp;
