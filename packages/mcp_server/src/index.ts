#!/usr/bin/env node

import "reflect-metadata";
import dotenv from "dotenv";
import * as fs from "fs";
import path from "path";
import yaml from "js-yaml";
import { container } from "tsyringe";
import { z } from "zod";
import express from "express";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { createContexts, serverConfigSchema } from "@yk-takemoto/mcp-handler";
import { SwitchBotTVControlFunction, SwitchBotLightControlFunction, SwitchBotAirconControlFunction } from "./functions/index.js";
import { devctlTools } from "./tools/index.js";

container.register("SwitchBotTVControlFunction", {
  useClass: SwitchBotTVControlFunction,
});
container.register("SwitchBotLightControlFunction", {
  useClass: SwitchBotLightControlFunction,
});
container.register("SwitchBotAirconControlFunction", {
  useClass: SwitchBotAirconControlFunction,
});

dotenv.config();
const getConfig = (serverRootPath: string = process.env.MCPSERVER_ROOTPATH!) => {
  const config = yaml.load(fs.readFileSync(path.resolve(serverRootPath, "config.yaml"), "utf-8"));
  return serverConfigSchema.parse(config);
};
const serverContexts = createContexts(getConfig());
const functions = serverContexts.devctl.function;

let stdioServer: Server;

// Create server instance
const getServer = () => {
  const server = new Server(
    {
      name: "smarthome-agent_server",
      version: "0.1.0",
    },
    {
      capabilities: {
        tools: {},
      },
    },
  );

  // List available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [...devctlTools],
    };
  });

  // Handle tool execution
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      const functionToCall = functions[name];
      const toolResult = functionToCall ? await functionToCall(args) : { error: `${name} is not available` };
      // debug
      console.error(`[mcpServer#CallToolRequestSchema] name: ${name}, args: ${args}, "toolResult: ${toolResult}`);
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
