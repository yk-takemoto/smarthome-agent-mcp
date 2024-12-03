import type { NextApiRequest, NextApiResponse } from "next";
import { errorHandler } from "@/api/error";
import { deviceControlTools, deviceControlFunctions } from "@/api/devctl";
import { llmAdapterBuilder } from "@/api/llm";
import { translateAdapterBuilder } from "@/api/translate";

const devCtlTools = deviceControlTools();
const devCtlFunctions = deviceControlFunctions();

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
  const { userId, requestMessage, requestLlmId, requestTranslateId } = req.body;
  if (!userId) {
    return res.status(400).json(errorHandler("No userId provided"));
  }
  if (!requestMessage) {
    return res.status(400).json(errorHandler("No requestMessage provided"));
  }

  const llmId = requestLlmId || "AzureOpenAI";
  const translateId = requestTranslateId || "DeepL";
  const options = {
    maxTokens: 1028,
    tools: devCtlTools,
    toolChoice: "auto",
  };
  try {
    const llmAdapter = llmAdapterBuilder(llmId);
    const translateAdapter = translateAdapterBuilder(translateId);
    const translatedMessage = await translateAdapter.translateText(requestMessage, "en-US");
    const messages = [
      {
        role: "system",
        content: "You are a smart home agent that can control devices in the home. The user will make requests in English, including the device names, but the assistant will respond in Japanese.",
      },
      {
        role: "user",
        content: translatedMessage
      }
    ];  
    const resObj = await llmAdapter.functionCalling(
      devCtlFunctions,
      messages,
      options
    );
    res.status(200).json(resObj);
  } catch (error) {
    res.status(500).json(errorHandler("[requestOperation] requestOperation failed", error));
  }
}