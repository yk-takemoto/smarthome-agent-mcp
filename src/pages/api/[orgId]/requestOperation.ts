import type { NextApiRequest, NextApiResponse } from "next";
import { errorHandler } from "@/api/error";
import { DeviceControlClient } from "@/api/devctl";
import { llmAdapterBuilder } from "@/api/llm";
import { translateAdapterBuilder } from "@/api/translate";

type ChatResponse = {
  resAssistantMessage: string;
  resToolMessages: {
    content: string;
  }[];
}

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
  let response: ChatResponse = {
    resAssistantMessage: "",
    resToolMessages: []
  };
  try {
    const llmAdapter = llmAdapterBuilder(llmId);

    let translatedMessage;
    let systemPrompt = "You are a smart home agent that can control devices in the home."
    if (translateId !== "None") {
      const translateAdapter = translateAdapterBuilder(translateId);
      translatedMessage = await translateAdapter.translateText(requestMessage, "en-US");
      systemPrompt += " The user will make requests in English, including the device names, but the assistant will respond in Japanese."
    }

    const devCtlClient = new DeviceControlClient();
    const tools = await devCtlClient.listToolResultSchema();

    const options = {
      maxTokens: 1028,
      tools: tools,
      toolChoice: "auto",
    };  
    const chatResponse = await llmAdapter.chatCompletions(
      [systemPrompt],
      [translatedMessage || requestMessage],
      options
    );

    if (chatResponse.tools.length === 0) {
      response.resAssistantMessage = chatResponse.text || "Sorry, there was no response from the agent.";
      return res.status(200).json(response);
    }

    const resToolMessages: any[] = [];
    let resToolMessage = { content: "{}" };
    const toolResults: {
      id: string;
      content: string;
    }[] = [];
    for (const tool of chatResponse.tools) {
      try {
        const resObj = await devCtlClient.callToolResultSchema(tool);
        resToolMessage = {
          content: resObj[0].text as string
        };
      } catch (error) {
        resToolMessage = {
          content: JSON.stringify(errorHandler("Sorry, an error occurred while operating the device. Please check if the device is in an operable state.", error))
        };
      } finally {
        toolResults.push({
          id: tool.id,
          ...resToolMessage
        });
        resToolMessages.push(resToolMessage);
      }
    }

    const nextChatResponse = await llmAdapter.chatCompletions(
      [systemPrompt],
      [],
      options,
      {
        messages: chatResponse.messages,
        toolResults: toolResults
      }
    );

    response = {
      resAssistantMessage: nextChatResponse.text || "Sorry, there was no response from the agent. If the following details are displayed, please check them.",
      resToolMessages: resToolMessages
    };
    res.status(200).json(response);
  } catch (error) {
    res.status(500).json(errorHandler("[requestOperation] requestOperation failed", error));
  }
}