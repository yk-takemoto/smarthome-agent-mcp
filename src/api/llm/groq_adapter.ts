import { promises as fs } from "fs";
import { Groq } from "groq-sdk";
import {
  ChatCompletionTool,
  ChatCompletionMessageParam,
  ChatCompletionToolChoiceOption,
} from "groq-sdk/resources/chat/completions";
import { LlmAdapter, FunctionCallingResponse, FunctionCallingOptions, TextToSpeechResponse } from "./llm_adapter"

export class GroqAdapter implements LlmAdapter {

  protected openaiClient;

  constructor(
    protected llmConfig = {
      apiKey: JSON.parse(process.env.APP_SECRETS || "{}").GROQ_API_KEY || process.env.GROQ_API_KEY || "",
      apiModelChat: process.env.GROQ_API_MODEL_CHAT!,
    },
  ) {
    this.initCheck(llmConfig);
    this.openaiClient = new Groq({apiKey: llmConfig.apiKey});
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
    messages: ChatCompletionMessageParam[],
    options: FunctionCallingOptions
  ): Promise<FunctionCallingResponse> {

    const funcMessages = Array.from(messages);
    const funcOtions = {
      model: this.llmConfig.apiModelChat,
      messages: funcMessages,
      tools: options.tools as ChatCompletionTool[],
      tool_choice: options.toolChoice || "auto" as ChatCompletionToolChoiceOption,
      max_tokens: options.maxTokens as number || 1028,
      temperature: options.temperature as number ?? 0.7,
      response_format: options.responseFormat,
    };
    const response: FunctionCallingResponse = {
      resAssistantMessage: "",
      resToolMessages: []
    };
    try {

      // debug
      console.log("[functionCalling] chatCompletions start -- funcMessages: ", JSON.stringify(funcMessages));
      const chatResponse = await this.openaiClient.chat.completions.create(funcOtions);
      const choice = chatResponse.choices[0];
      const finishReason = choice.finish_reason;
      // debug
      console.log(`[functionCalling] chatCompletions end -- choices[0].message: ${JSON.stringify(choice.message)} finishReason: ${finishReason}`);
  
      if (finishReason !== "tool_calls") {
        response.resAssistantMessage = choice.message?.content || "Sorry, there was no response from the agent.";
        return response;
      }
      
      if (choice.message) {
        const toolMessage = choice.message;
        funcMessages.push(toolMessage);
  
        for (const toolCall of toolMessage?.tool_calls || []) {
          const functionName = toolCall.function.name;
          const functionToCall = functions[functionName];
          const functionArgs = JSON.parse(toolCall.function.arguments);
          const values = Object.values(functionArgs);
          const functionOutput = functionToCall ? await functionToCall(...values) : {error: `${functionName} is not available`};
          // debug
          console.log("[functionCalling] ", functionName, functionArgs, "function_output: ", functionOutput);
  
          const content = { ...functionArgs, function_output: functionOutput };
          const toolMessage = {
            tool_call_id: toolCall.id,
            role: "tool",
            content: JSON.stringify(content),
          };
          funcMessages.push(toolMessage as ChatCompletionMessageParam);
          response.resToolMessages.push(toolMessage);
        }
        // debug
        console.log("[functionCalling] chatCompletions start -- funcMessages: ", JSON.stringify(funcMessages));
        funcOtions.messages = funcMessages;
        const nextChatResponse = await this.openaiClient.chat.completions.create(funcOtions);
        response.resAssistantMessage = nextChatResponse.choices[0].message?.content || "Sorry, there was no response from the agent. If the following details are displayed, please check them.";
        // debug
        console.log(`[functionCalling] chatCompletions end -- choices[0].message?.content: ${response.resAssistantMessage}`);
  
        funcMessages.push({ role: "assistant", content: response.resAssistantMessage });
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