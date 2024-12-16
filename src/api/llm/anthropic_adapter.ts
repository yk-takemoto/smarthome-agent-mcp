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
import {
  LlmAdapter,
  TextToSpeechResponse,
  McpTool,
  ChatCompletionsOptions,
  ChatCompletionsResponse
} from "./llm_adapter"

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

  private convertTools(tools: McpTool[]): Tool[] {
    return tools.map(tool => {
      return {
        name: tool.name,
        description: tool.description,
        input_schema: tool.inputSchema as Tool.InputSchema
      }
    });
  }

  async chatCompletions(
    systemPrompt: string[],
    firstMessages: string[],
    options: ChatCompletionsOptions,
    inProgress?: {
      messages: MessageParam[];
      toolResults?: {
        id: string;
        content: string;
      }[];
    }
  ): Promise<ChatCompletionsResponse> {

    const covertedSystemPrompt: TextBlockParam[] = [];
    systemPrompt.forEach(msg => {
      covertedSystemPrompt.push({
        type: "text",
        text: msg,
      });
    });
    let updatedMessages: MessageParam[] = [];
    if (inProgress) {
      const resMessages = inProgress.toolResults?.map(toolResult => {
        return {
          tool_use_id: toolResult.id,
          type: "tool_result" as "tool_result",
          content: toolResult.content
        } as ToolResultBlockParam;
      }) || [];
      updatedMessages = inProgress.messages.concat(
        { role: "user", content: resMessages }
      );
    } else {
      firstMessages.forEach(msg => {
        updatedMessages.push({
          role: "user",
          content: msg,
        });
      });
    }
    const funcOtions: MessageCreateParams = {
      model: this.llmConfig.apiModelChat,
      messages: updatedMessages,
      system: covertedSystemPrompt,
      tools: this.convertTools(options.tools),
      tool_choice: {type: options.toolChoice || "auto"} as ToolChoice,
      max_tokens: options.maxTokens as number || 1028,
      temperature: options.temperature as number ?? 0.7,
    };
    let response: ChatCompletionsResponse = {
      text: "",
      tools: [],
      messages: []
    };
    try {

      // debug
      console.log(
        "[chatCompletions] start -- covertedSystemPrompt: ", JSON.stringify(covertedSystemPrompt),
        " -- updatedMessages: ", JSON.stringify(updatedMessages)
      );
      const chatResponse = await this.anthropicClient.messages.create(funcOtions);
      const contents = chatResponse.content;
      const stopReason = chatResponse.stop_reason;
      // debug
      console.log(`[chatCompletions] end -- contents: ${JSON.stringify(contents)} stopReason: ${stopReason}`);
  
      let resTools: { id:string, name:string, arguments: Record<string, any> }[] = [];
      if (chatResponse) {
        updatedMessages.push({
          role: chatResponse.role,
          content: contents
        });
        resTools = (
          stopReason === "tool_use"
        ) ? contents?.filter(
          contentBlock => contentBlock.type === "tool_use"
        ).map(contentBlock => {
          return {
            id: contentBlock.id,
            name: contentBlock.name,
            arguments: JSON.parse(JSON.stringify(contentBlock.input)) as Record<string, any>
          };
        }) || [] : [];
      }

      response = {
        text: (contents[0] as TextBlock).text || null,
        tools: resTools,
        messages: updatedMessages
      };
    } catch (error) {
      // debug
      console.log("[chatCompletions] Error: ", error);
      throw error;
    }

    // debug
    console.log("[chatCompletions] response: ", response);
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