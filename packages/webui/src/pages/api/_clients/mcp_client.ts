import {
  CallToolResultSchema,
  ListToolsResultSchema,
} from "@modelcontextprotocol/sdk/types.js";
import mcpClientManager from "./mcp_client_manager";

export const getSessionId = async (userId?: string): Promise<string | null> => {
  try {
    const session = await mcpClientManager.getSession(userId);
    return session?.sessionId || null;
  } catch (error) {
    console.error("[mcp_client#getOrCreateSessionId] Error:", error);
    throw error;
  }
};

export const terminateSession = async (userId?: string): Promise<void> => {
  try {
    await mcpClientManager.terminateSession(userId);
  } catch (error) {
    console.error("[mcp_client#terminateSession] Error:", error);
    throw error;
  }
};

export const listTools = async (userId?: string) => {
  try {
    const session = await mcpClientManager.getSession(userId);
    const res = await session.client.request(
      { method: "tools/list" },
      ListToolsResultSchema,
    );
    return res.tools;
  } catch (error) {
    console.error("[mcp_client#listTools] Error listing tools:", error);
    throw error;
  }
};

export const callTool = async (param: {
  userId?: string;
  tool: {
    name: string;
    arguments: Record<string, any>;
  };
}) => {
  try {
    const session = await mcpClientManager.getSession(param.userId);
    const res = await session.client.request(
      {
        method: "tools/call",
        params: param.tool,
      },
      CallToolResultSchema,
    );
    return res.content;
  } catch (error) {
    console.error("[mcp_client#callTool] Error calling tool:", error);
    throw error;
  }
};
