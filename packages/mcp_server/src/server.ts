import dotenv from "dotenv";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  tvControlArgsSchemaObject,
  SwitchBotTVControlFunction,
  lightControlArgsSchemaObject,
  SwitchBotLightControlFunction,
  airconControlArgsSchemaObject,
  SwitchBotAirconControlFunction,
} from "./tools/index.js";

dotenv.config();

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

export default getServer;
