import { promises as fs } from "fs";
import Anthropic from "@anthropic-ai/sdk";
import {
  TextBlockParam,
  MessageParam,
  MessageCreateParams,
  Tool,
  ToolChoice,
  TextBlock,
  ToolResultBlockParam
} from "@anthropic-ai/sdk/resources/messages.mjs";
import { LlmAdapter, FunctionCallingResponse, FunctionCallingOptions, TextToSpeechResponse } from "./llm_adapter"

export class AnthropicAdapter implements LlmAdapter {

  protected anthropicClient;

  constructor(
    protected llmConfig = {
      apiKey: JSON.parse(process.env.APP_SECRETS || "{}").ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY || "",
      apiModelChat: process.env.ANTHROPIC_API_MODEL_CHAT!,
    },
  ) {
    this.initCheck(llmConfig);
    this.anthropicClient = new Anthropic({apiKey: llmConfig.apiKey});
  };

  private initCheck(llmConfig: Record<string, string>) {
    for (const key of Object.keys(this.llmConfig)) {
      if (!llmConfig[key]) {
        throw new Error(`llmConfig.${key} is required but not set.`);
      }
    }
  }

  async functionCalling(
    functions: { [functionId: string]: Function },
    systemPrompt: string[],
    messages: string[],
    options: FunctionCallingOptions
  ): Promise<FunctionCallingResponse> {

    const funcSystemPrompt: TextBlockParam[] = [];
    systemPrompt.forEach(msg => {
      funcSystemPrompt.push({
        type: "text",
        text: msg,
      });
    });
    const funcMessages: MessageParam[] = [];
    messages.forEach(msg => {
      funcMessages.push({
        role: "user",
        content: msg,
      });
    });
    const funcOtions: MessageCreateParams = {
      model: this.llmConfig.apiModelChat,
      messages: funcMessages,
      system: funcSystemPrompt,
      tools: options.tools as Tool[],
      tool_choice: {type: options.toolChoice || "auto"} as ToolChoice,
      max_tokens: options.maxTokens as number || 1028,
      temperature: options.temperature as number ?? 0.7,
    };
    const response: FunctionCallingResponse = {
      resAssistantMessage: "",
      resToolMessages: []
    };
    try {

      // debug
      console.log(
        "[functionCalling] chatCompletions start -- funcSystemPrompt: ", JSON.stringify(funcSystemPrompt),
        " -- funcMessages: ", JSON.stringify(funcMessages)
      );
      const chatResponse = await this.anthropicClient.messages.create(funcOtions);
      const contents = chatResponse.content;
      const stopReason = chatResponse.stop_reason;
      // debug
      console.log(`[functionCalling] chatCompletions end -- contents: ${JSON.stringify(contents)} stopReason: ${stopReason}`);
  
      if (stopReason !== "tool_use") {
        response.resAssistantMessage = (contents[0] as TextBlock).text || "Sorry, there was no response from the agent.";
        return response;
      }
      if (chatResponse) {
        funcMessages.push({
          role: chatResponse.role,
          content: contents
        });
        const toolResults: ToolResultBlockParam[] = [];
        for (const contentBlock of contents || []) {
          if (contentBlock.type !== "tool_use") {
            continue;
          }
          const functionName = contentBlock.name;
          const functionToCall = functions[functionName];
          const functionArgs = JSON.parse(JSON.stringify(contentBlock.input));
          const values = Object.values(functionArgs);
          const functionOutput = functionToCall ? await functionToCall(...values) : {error: `${functionName} is not available`};
          // debug
          console.log("[functionCalling] ", functionName, functionArgs, "function_output: ", functionOutput);
  
          const content = { ...functionArgs, function_output: functionOutput };
          const resToolMessage = {
            content: JSON.stringify(content)
          };
          const toolResult = {
            tool_use_id: contentBlock.id,
            type: "tool_result" as "tool_result",
            ...resToolMessage
          };
          toolResults.push(toolResult);
          response.resToolMessages.push(resToolMessage);
        }
        funcMessages.push({ role: "user", content: toolResults });

        // debug
        console.log("[functionCalling] chatCompletions start -- funcMessages: ", JSON.stringify(funcMessages));
        funcOtions.messages = funcMessages;
        const nextChatResponse = await this.anthropicClient.messages.create(funcOtions);
        response.resAssistantMessage = (nextChatResponse.content[0] as TextBlock).text || "Sorry, there was no response from the agent. If the following details are displayed, please check them.";
        // debug
        console.log(`[functionCalling] chatCompletions end -- content[0].text: ${response.resAssistantMessage}`);
  
        // funcMessages.push({ role: "assistant", content: response.resAssistantMessage });
      }
    } catch (error) {
      // debug
      console.log("[functionCalling] Error: ", error);
      throw error;
    }

    // debug
    console.log("[functionCalling] response: ", response);
    return response;
  }

  async textToSpeech(_: string, options: Record<string, any>): Promise<TextToSpeechResponse> {
    //================ Not supported
    try {
      const sorryFormat = (options.responseFormat === "wav" || options.responseFormat === "aac") ? options.responseFormat : "mp3";
      const sorry = await fs.readFile(`audio/sorry.ja.${sorryFormat}`);
      const contentType = sorryFormat === "mp3" ? "audio/mpeg" : `audio/${sorryFormat}`;
      return {
        contentType: contentType,
        content: sorry
      }
    } catch (error) {
      // debug
      console.log("[textToSpeech] Error: ", error);
      throw error;
    }
  }
}