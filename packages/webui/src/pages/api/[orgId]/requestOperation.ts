import type { NextApiRequest, NextApiResponse } from "next";
import { errorHandler } from "@yk-takemoto/error-handler";
import { llmAdapterHelper } from "@yk-takemoto/llm-adapter";
import { translateAdapterHelper } from "@yk-takemoto/translate-adapter";
import * as mcpClient from "../_clients/mcp_client";

type ChatResponse = {
  resAssistantMessage: string;
  resToolMessages: {
    content: string;
  }[];
};

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
  const { userId, tools, requestMessage, requestLlmId, requestTranslateId } =
    req.body;
  if (!userId) {
    return res.status(400).json(errorHandler("No userId provided"));
  }
  if (!tools || !Array.isArray(tools)) {
    return res.status(400).json(errorHandler("Invalid tools provided"));
  }
  if (!requestMessage) {
    return res.status(400).json(errorHandler("No requestMessage provided"));
  }

  const llmId = requestLlmId || "AzureOpenAI";
  const translateId = requestTranslateId || "DeepL";
  let response: ChatResponse = {
    resAssistantMessage: "",
    resToolMessages: [],
  };
  try {
    const llmHelper = llmAdapterHelper({ llmId });

    let translatedMessage;
    let systemPrompt =
      "You are a smart home agent that can control devices in the home.";
    if (translateId !== "None") {
      const translatHelper = translateAdapterHelper({ translateId });
      translatedMessage = await translatHelper.translateText({
        args: {
          sourceText: requestMessage,
          targetLang: "en-US",
        },
      });
      systemPrompt +=
        " The user will make requests in English, including the device names, but the assistant will respond in Japanese.";
    }

    const options = {
      tools: tools,
      toolOption: {
        type: "function" as const,
        choice: "auto",
        maxTokens: 1028,
      },
    };
    const chatResponse = await llmHelper.chatCompletions({
      args: {
        systemPrompt: [systemPrompt],
        newMessageContents: [
          {
            text: translatedMessage || requestMessage,
          },
        ],
        options,
      },
    });

    if (chatResponse.tools.length === 0) {
      response.resAssistantMessage =
        chatResponse.text || "Sorry, there was no response from the agent.";
      return res.status(200).json(response);
    }

    const resToolMessages: any[] = [];
    let resToolMessage = { content: "{}" };
    const toolResForNextChat: {
      id: string;
      content: string;
    }[] = [];
    for (const tool of chatResponse.tools) {
      try {
        const resObj = await mcpClient.callTool({ userId, tool });
        resToolMessage = {
          content: resObj[0].text as string,
        };
      } catch (error) {
        resToolMessage = {
          content: JSON.stringify(
            errorHandler(
              "Sorry, an error occurred while operating the device. Please check if the device is in an operable state.",
              error,
            ),
          ),
        };
      } finally {
        toolResForNextChat.push({
          id: tool.id,
          ...resToolMessage,
        });
        resToolMessages.push(resToolMessage);
      }
    }

    const nextChatResponse = await llmHelper.chatCompletions({
      args: {
        systemPrompt: [systemPrompt],
        newMessageContents: [],
        options,
        inProgress: {
          messages: chatResponse.messages,
          toolResults: toolResForNextChat,
        },
      },
    });

    response = {
      resAssistantMessage:
        nextChatResponse.text ||
        "Sorry, there was no response from the agent. If the following details are displayed, please check them.",
      resToolMessages,
    };
    res.status(200).json(response);
  } catch (error) {
    res
      .status(500)
      .json(errorHandler("[requestOperation] requestOperation failed", error));
  }
}
