import { z } from "zod";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import {
  CallToolResultSchema,
  ListToolsResultSchema,
} from "@modelcontextprotocol/sdk/types.js";

const transportTypeSchema = z
  .enum(["stdio", "streamableHttp"])
  .nullish()
  .or(z.literal(""))
  .default("stdio");
const mcpClientStdioConfigSchema = z.object({
  nodeHome: z.string().min(1),
  mcpServerRootPath: z.string().min(1),
  switchbotToken: z.string().min(1),
  switchbotSecretKey: z.string().min(1),
  switchbotEndpoint: z.string().min(1),
  switchbotFunctionDeviceidsMap: z.string().min(1),
  nodeExtraCaCerts: z.string().optional(),
});
const mcpClientStreamableHttpConfigSchema = z.object({
  mcpServerUrl: z.string().url().default("http://localhost:3000/mcp"),
});
const transportType = transportTypeSchema.parse(
  process.env.MCP_CLIENT_TRANSPORT_TYPE,
);
let client: Client | null = null;
let transport: StdioClientTransport | StreamableHTTPClientTransport | null =
  null;
let sessionId: string | undefined;

const getStdioClientTransport = () => {
  const mcpClientStdioConfig = mcpClientStdioConfigSchema.parse({
    nodeHome: process.env.NODE_HOME || "",
    mcpServerRootPath: process.env.MCPSERVER_ROOTPATH || process.cwd(),
    switchbotToken:
      JSON.parse(process.env.APP_SECRETS || "{}").SWITCHBOT_TOKEN ||
      process.env.SWITCHBOT_TOKEN ||
      "",
    switchbotSecretKey:
      JSON.parse(process.env.APP_SECRETS || "{}").SWITCHBOT_SECRET_KEY ||
      process.env.SWITCHBOT_SECRET_KEY ||
      "",
    switchbotEndpoint: process.env.SWITCHBOT_ENDPOINT || "",
    switchbotFunctionDeviceidsMap:
      JSON.parse(process.env.APP_SECRETS || "{}")
        .SWITCHBOT_FUNCTION_DEVICEIDS_MAP ||
      process.env.SWITCHBOT_FUNCTION_DEVICEIDS_MAP ||
      "",
    nodeExtraCaCerts: process.env.NODE_EXTRA_CA_CERTS,
  });
  return new StdioClientTransport({
    command: `${mcpClientStdioConfig.nodeHome}/bin/node`,
    args: [`${mcpClientStdioConfig.mcpServerRootPath}/build/index.js`],
    env: {
      MCPSERVER_ROOTPATH: mcpClientStdioConfig.mcpServerRootPath,
      SWITCHBOT_TOKEN: mcpClientStdioConfig.switchbotToken,
      SWITCHBOT_SECRET_KEY: mcpClientStdioConfig.switchbotSecretKey,
      SWITCHBOT_ENDPOINT: mcpClientStdioConfig.switchbotEndpoint,
      SWITCHBOT_FUNCTION_DEVICEIDS_MAP:
        mcpClientStdioConfig.switchbotFunctionDeviceidsMap,
      ...(mcpClientStdioConfig.nodeExtraCaCerts
        ? { NODE_EXTRA_CA_CERTS: mcpClientStdioConfig.nodeExtraCaCerts }
        : {}),
    },
  });
};

const getStreamableHTTPServerTransport = () => {
  const mcpClientStreamableHttpConfig =
    mcpClientStreamableHttpConfigSchema.parse({
      mcpServerUrl: process.env.MCPSERVER_URL,
    });
  return new StreamableHTTPClientTransport(
    new URL(mcpClientStreamableHttpConfig.mcpServerUrl),
    {
      sessionId,
      requestInit: {
        // For CORS
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json, text/event-stream", // accept JSON and SSE
        },
        // include cookies in requests - necessary for session management
        // especially when using session-based authentication
        credentials: "include",
        // allow cross-origin requests
        mode: "cors",
      },
    },
  );
};

export const initializeClient = async () => {
  if (client && transport) return;
  try {
    client = new Client({ name: "smarthome-agent_client", version: "0.1.0" });
    client.onerror = (error) => {
      console.error("[mcp_client#initializeClient] Client error:", error);
    };
    transport =
      transportType === "streamableHttp"
        ? getStreamableHTTPServerTransport()
        : getStdioClientTransport();

    await client.connect(transport);

    sessionId =
      transport instanceof StreamableHTTPClientTransport
        ? transport.sessionId
        : undefined;
  } catch (error) {
    console.error(
      "[mcp_client#initializeClient] Failed to initialize MCP client:",
      error,
    );
    throw error;
  }
};

const getClient = async () => {
  if (!client || !transport) {
    await initializeClient();
    if (!client || !transport) {
      throw new Error(
        "[mcp_client#getClient] MCP client or transport is not initialized",
      );
    }
  }
  return client;
};

export const getSessionId = () => {
  return sessionId;
};

export const terminateSession = async () => {
  if (!transport) {
    // debug
    console.log(
      "[mcp_client#terminateSession] No active transport to terminate",
    );
    return;
  }
  if (transport instanceof StdioClientTransport) {
    // debug
    console.log(
      "[mcp_client#terminateSession] Stdio transport does not support session termination.",
    );
    return;
  }

  try {
    await transport.terminateSession();
    // debug
    console.log("[mcp_client#terminateSession] Session terminated");
    sessionId = undefined;
    await closeClient();
  } catch (error) {
    // debug
    console.error(
      "[mcp_client#terminateSession] Error terminating session:",
      error,
    );
    throw error;
  }
};

export const closeClient = async () => {
  try {
    if (transport) {
      await transport.close();
      // debug
      console.log("[mcp_client#closeClient] Transport closed");
    }
    if (client) {
      await client.close();
      // debug
      console.log("[mcp_client#closeClient] Client closed");
    }
    client = null;
    transport = null;
  } catch (error) {
    // debug
    console.error("[mcp_client#closeClient] Error closing client:", error);
    throw error;
  }
};

export const listTools = async () => {
  const client = await getClient();
  try {
    const res = await client.request(
      { method: "tools/list" },
      ListToolsResultSchema,
    );
    return res.tools;
  } catch (error) {
    // debug
    console.error("[mcp_client#listTools] Error listing tools:", error);
    throw error;
  }
};

export const callTool = async (tool: {
  name: string;
  arguments: Record<string, any>;
}) => {
  const client = await getClient();
  try {
    const res = await client.request(
      {
        method: "tools/call",
        params: tool,
      },
      CallToolResultSchema,
    );
    return res.content;
  } catch (error) {
    // debug
    console.error("[mcp_client#callTool] Error calling tool:", error);
    throw error;
  }
};
