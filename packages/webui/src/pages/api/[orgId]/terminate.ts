import type { NextApiRequest, NextApiResponse } from "next";
import { errorHandler } from "@yk-takemoto/error-handler";
import * as mcpClient from "../_clients/mcp_client";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res
      .status(405)
      .json(errorHandler(`Method ${req.method} Not Allowed`));
  }

  const { orgId } = req.query;
  if (!orgId) {
    return res.status(400).json(errorHandler("No orgId provided"));
  }
  const { userId } = req.body;
  if (!userId) {
    return res.status(400).json(errorHandler("No userId provided"));
  }

  try {
    await mcpClient.terminateSession(userId);
    res
      .status(200)
      .json({ success: true, message: "Session terminated successfully" });
  } catch (error) {
    res
      .status(500)
      .json(
        errorHandler("[terminateSession] Failed to terminate session", error),
      );
  }
}
