import type { NextApiRequest, NextApiResponse } from "next";
import { errorHandler } from "@/api/error";
import { llmAdapterBuilder } from "@/api/llm";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json(errorHandler(`Method ${req.method} Not Allowed`));
  }

  const { orgId } = req.query;
  if (!orgId) {
    return res.status(400).json(errorHandler("No orgId provided"));
  }
  const { userId, requestMessage, responseFormat, requestLlmId } = req.body;
  if (!userId) {
    return res.status(400).json(errorHandler("No userId provided"));
  }
  if (!requestMessage) {
    return res.status(400).json(errorHandler("No requestMessage provided"));
  }

  const llmId = requestLlmId || "AzureOpenAI";
  const options = responseFormat ? {responseFormat} : {};
  try {
    const llmAdapter = llmAdapterBuilder(llmId);
    const resObj = await llmAdapter.textToSpeech(
      requestMessage,
      options
    );
    res.setHeader("Content-Type", resObj.contentType);
    res.status(200).send(resObj.content);
  } catch (error) {
    res.status(500).json(errorHandler("[textToSpeech] textToSpeech failed", error));
  }
}