#!/usr/bin/env node

import dotenv from "dotenv";
import { z } from "zod";
import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
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

// POST request handler for the Streamable HTTP transport
app.post("/mcp", async (req, res) => {
  console.log("Received POST MCP request:", req.body);
  try {
    const server = getServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });
    res.on("close", () => {
      console.log("MCP request closed");
      transport.close();
      server.close();
    });
    await server.connect(transport);
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

// Start the server
async function main() {
  const args = process.argv.slice(2);
  if (args.length > 0 && args[0] === "--http") {
    const port = parseInt(args[1], 10) || 3000;
    app.listen(port, () => {
      console.log(`Smart home agent MCP Stateless Streamable HTTP Server listening on port ${port}`);
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
