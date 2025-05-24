#!/usr/bin/env node

import dotenv from "dotenv";
import { z } from "zod";
import express from "express";
import { randomUUID } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { InMemoryEventStore } from "@modelcontextprotocol/sdk/examples/shared/inMemoryEventStore.js";
import {
  tvControlArgsSchemaObject,
  SwitchBotTVControlFunction,
  lightControlArgsSchemaObject,
  SwitchBotLightControlFunction,
  airconControlArgsSchemaObject,
  SwitchBotAirconControlFunction,
} from "./tools/index.js";

dotenv.config();

let stdioServer: McpServer;

// Create server instance
const getServer = () => {
  const server = new McpServer({
    name: "smarthome-agent_server",
    version: "0.1.0",
  });

  // TV
  server.tool("tv", "The Tool to control TV", tvControlArgsSchemaObject, async (args) => {
    try {
      // debug
      console.error(`[mcpServer#callback] name: tv, args: ${JSON.stringify(args)}`);
      const toolResult = await new SwitchBotTVControlFunction("tv").execute(args);
      // debug
      console.error(`[mcpServer#callback] toolResult: ${toolResult}`);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ args, toolResult }),
          },
        ],
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(`Invalid arguments: ${error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ")}`);
      }
      throw error;
    }
  });

  // Light
  server.tool("light", "The Tool to control light", lightControlArgsSchemaObject, async (args) => {
    try {
      // debug
      console.error(`[mcpServer#callback] name: light, args: ${JSON.stringify(args)}`);
      const toolResult = await new SwitchBotLightControlFunction("light").execute(args);
      // debug
      console.error(`[mcpServer#callback] toolResult: ${toolResult}`);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ args, toolResult }),
          },
        ],
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(`Invalid arguments: ${error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ")}`);
      }
      throw error;
    }
  });

  // Aircon
  server.tool("aircon", "The Tool to control air conditioner", airconControlArgsSchemaObject, async (args) => {
    try {
      // debug
      console.error(`[mcpServer#callback] name: aircon, args: ${JSON.stringify(args)}`);
      const toolResult = await new SwitchBotAirconControlFunction("aircon").execute(args);
      // debug
      console.error(`[mcpServer#callback] toolResult: ${toolResult}`);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ args, toolResult }),
          },
        ],
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(`Invalid arguments: ${error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ")}`);
      }
      throw error;
    }
  });

  return server;
};

// Set up the server with the Streamable HTTP transport
const app = express();
app.use(express.json());

// Map to store transports by session ID
const transports: { [sessionId: string]: StreamableHTTPServerTransport } = {};
let isHttpStatefull = false;

// POST request handler for the Streamable HTTP transport
app.post("/mcp", async (req, res) => {
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
        return;
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

// Start the server
async function main() {
  const args = process.argv.slice(2);
  if (args.length > 0 && (args[0] === "--http" || args[0] === "--http-stateless")) {
    isHttpStatefull = args[0] === "--http";
    const port = parseInt(args[1], 10) || 3000;
    app.listen(port, () => {
      console.log(`Smart home agent MCP Streamable HTTP Server (${isHttpStatefull ? "statefull" : "stateless"}) listening on port ${port}`);
    });
  } else {
    console.error("No transport specified, falling back to stdio");
    const transport = new StdioServerTransport();
    stdioServer = getServer();
    await stdioServer.connect(transport);
    console.error("Smart home agent MCP Server running on stdio");
  }
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
