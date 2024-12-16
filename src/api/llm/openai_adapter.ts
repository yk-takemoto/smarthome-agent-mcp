import OpenAI from "openai";
import {
  LlmAdapter,
  TextToSpeechResponse,
  McpTool,
  ChatCompletionsOptions,
  ChatCompletionsResponse
} from "./llm_adapter"

export class OpenAIAdapter<T extends OpenAI> implements LlmAdapter {

  protected openaiClient;

  constructor(
    protected llmConfig = {
      apiKey: JSON.parse(process.env.APP_SECRETS || "{}").OPENAI_API_KEY || process.env.OPENAI_API_KEY || "",
      apiModelChat: process.env.OPENAI_API_MODEL_CHAT!,
      apiModelText2Speech: process.env.OPENAI_API_MODEL_TEXT2SPEECH!
    },
    apiClient?: T,
  ) {
    this.initCheck(llmConfig);
    this.openaiClient = apiClient || new OpenAI({apiKey: llmConfig.apiKey});
  };

  private initCheck(llmConfig: Record<string, string>) {
    for (const key of Object.keys(this.llmConfig)) {
      if (!llmConfig[key]) {
        throw new Error(`llmConfig.${key} is required but not set.`);
      }
    }
  }

  private convertTools(tools: McpTool[]): OpenAI.ChatCompletionTool[] {
    return tools.map(tool => {
      return {
        type: "function",
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.inputSchema
        }
      };
    });
  }

  async chatCompletions(
    systemPrompt: string[],
    firstMessages: string[],
    options: ChatCompletionsOptions,
    inProgress?: {
      messages: OpenAI.ChatCompletionMessageParam[];
      toolResults?: {
        id: string;
        content: string;
      }[];
    }
  ): Promise<ChatCompletionsResponse> {

    let updatedMessages: OpenAI.ChatCompletionMessageParam[] = [];
    if (inProgress) {
      const resMessages = inProgress.toolResults?.map(toolResult => {
        return {
          tool_call_id: toolResult.id,
          role: "tool",
          content: toolResult.content
        } as OpenAI.ChatCompletionMessageParam;
      }) || [];
      updatedMessages = inProgress.messages.concat(resMessages);
    } else {
      systemPrompt.forEach(msg => {
        updatedMessages.push({
          role: "system",
          content: msg,
        });
      });
      firstMessages.forEach(msg => {
        updatedMessages.push({
          role: "user",
          content: msg,
        });
      });
    }
    const chatOtions = {
      model: this.llmConfig.apiModelChat,
      messages: updatedMessages,
      tools: this.convertTools(options.tools),
      tool_choice: options.toolChoice || "auto" as OpenAI.ChatCompletionToolChoiceOption,
      max_tokens: options.maxTokens as number || 1028,
      temperature: options.temperature as number ?? 0.7,
      response_format: options.responseFormat,
    };
    let response: ChatCompletionsResponse = {
      text: "",
      tools: [],
      messages: []
    };
    try {

      // debug
      console.log("[chatCompletions] start -- updatedMessages: ", JSON.stringify(updatedMessages));
      const chatResponse = await this.openaiClient.chat.completions.create(chatOtions);
      const choice = chatResponse.choices[0];
      const finishReason = choice.finish_reason;
      // debug
      console.log(`[chatCompletions] end -- choices[0].message: ${JSON.stringify(choice.message)} finishReason: ${finishReason}`);
  
      let resTools: { id:string, name:string, arguments: Record<string, any> }[] = [];
      if (choice.message) {
        updatedMessages.push(choice.message);
        resTools = (
          finishReason === "tool_calls"
        ) ? choice.message.tool_calls?.map(tool_call => {
          return {
            id: tool_call.id,
            name: tool_call.function.name,
            arguments: JSON.parse(tool_call.function.arguments) as Record<string, any>
          };
        }) || [] : [];
      }

      response = {
        text: choice.message?.content,
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

  async textToSpeech(message: string, options: Record<string, any>): Promise<TextToSpeechResponse> {

    const speechOtions = {
      model: this.llmConfig.apiModelText2Speech || "tts-1",
      input: message,
      voice: options.voice || "alloy",
      response_format: options.responseFormat || "mp3",
    };
    try {
      const response = await this.openaiClient.audio.speech.create(speechOtions);
      const contentType = response.headers.get("content-type");
      const arrayBuffer = await response.arrayBuffer();
      return {
        contentType: contentType!,
        content: Buffer.from(arrayBuffer)
      }
    } catch (error) {
      // debug
      console.log("[textToSpeech] Error: ", error);
      throw error;
    }
  }
}