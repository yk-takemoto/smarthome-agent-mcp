import { promises as fs } from "fs";
import {
  GoogleGenerativeAI,
  HarmBlockThreshold,
  HarmCategory,
  ModelParams,
  Content,
  FunctionDeclaration,
  Tool,
  FunctionCallingMode, 
  FunctionCallPart} from "@google/generative-ai";
import {
  LlmAdapter,
  TextToSpeechResponse,
  McpTool,
  ChatCompletionsOptions,
  ChatCompletionsResponse
} from "./llm_adapter"

export class GeminiAdapter implements LlmAdapter {

  protected geminiClient;

  constructor(
    protected llmConfig = {
      apiKey: JSON.parse(process.env.APP_SECRETS || "{}").GEMINI_API_KEY || process.env.GEMINI_API_KEY || "",
      apiModelChat: process.env.GEMINI_API_MODEL_CHAT!,
    },
  ) {
    this.initCheck(llmConfig);
    this.geminiClient = new GoogleGenerativeAI(llmConfig.apiKey);
  };

  private initCheck(llmConfig: Record<string, string>) {
    for (const key of Object.keys(this.llmConfig)) {
      if (!llmConfig[key]) {
        throw new Error(`llmConfig.${key} is required but not set.`);
      }
    }
  }

  private convertTools(tools: McpTool[]): Tool[] {
    const functions = tools.map(tool => {
      return {
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema
      } as FunctionDeclaration;
    });
    return [{ functionDeclarations: functions }];
  }

  async chatCompletions(
    systemPrompt: string[],
    firstMessages: string[],
    options: ChatCompletionsOptions,
    inProgress?: {
      messages: Content[];
      toolResults?: {
        id: string;
        content: string;
      }[];
    }
  ): Promise<ChatCompletionsResponse> {

    const covertedSystemPrompt: Content = {
      role: "model",
      parts: []
    };
    systemPrompt.forEach(msg => {
      covertedSystemPrompt.parts.push({
        text: msg,
      });
    });
    let updatedMessages: Content[] = [];
    if (inProgress) {
      const resMessages = inProgress.toolResults?.map(toolResult => {
        return {
          role: "user",
          parts: [{ text: toolResult.content }]
        } as Content;
      }) || [];
      updatedMessages = inProgress.messages.concat(resMessages);
    } else {
      firstMessages.forEach(msg => {
        updatedMessages.push({
          role: "user",
          parts: [{ text: msg }]
        });
      });
    }
    const modelParams: ModelParams = {
      safetySettings: [
        {
          category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
          threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
        },
      ],
      generationConfig: {
        maxOutputTokens: options.maxTokens as number || 1028,
        temperature: options.temperature as number ?? 0.7,
      },
      model: this.llmConfig.apiModelChat,
      tools: this.convertTools(options.tools),
      toolConfig: {
        functionCallingConfig: {
          mode: String(options.toolChoice).toUpperCase() as FunctionCallingMode || FunctionCallingMode.AUTO
        }
      },
      systemInstruction: covertedSystemPrompt,
    };
    let response: ChatCompletionsResponse = {
      text: "",
      tools: [],
      messages: []
    };
    try {

      // debug
      console.log("[chatCompletions] start -- updatedMessages: ", JSON.stringify(updatedMessages));
      const lastMessage = updatedMessages.pop()?.parts[0].text;
      if (!lastMessage) {
        throw new Error("lastMessage is missing because updatedMessages is empty.");
      }
      const chatSession = this.geminiClient.getGenerativeModel(modelParams).startChat({
        history: updatedMessages
      });

      const chatResult = await chatSession.sendMessage(lastMessage);
      const chatResponse = chatResult.response;
      const text = chatResponse.text();
      const funcCalls = chatResponse.functionCalls();
      const finishReason = chatResponse.candidates && chatResponse.candidates[0].finishReason;
      // debug
      console.log(`[chatCompletions] end -- response.text: ${text} response.functionCalls: ${JSON.stringify(funcCalls)} finishReason: ${finishReason}`);
  
      let resTools: { id:string, name:string, arguments: Record<string, any> }[] = [];
      if (chatResponse) {
        const parts: FunctionCallPart[] = [];
        resTools = (
          funcCalls
        ) ? funcCalls?.map(funcCall => {
          parts.push({ functionCall: funcCall });
          return {
            id: "",
            name: funcCall.name,
            arguments: JSON.parse(JSON.stringify(funcCall.args)) as Record<string, any>
          };
        }) || [] : [];
        updatedMessages.push({ role: "model", parts: parts });
      }

      response = {
        text: text,
        tools: resTools,
        messages: updatedMessages
      };
    } catch (error) {
      // debug
      console.log("[chatCompletions] Error: ", error);
      throw error;
    }

    // debug
    console.log("[chatCompletions] response: ", JSON.stringify(response));
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