export type ChatCompletionsResponse = {
  text: string | null;
  tools: {
    id: string;
    name: string;
    arguments: Record<string, any>;
  }[];
  messages: any[];
}

export type ChatCompletionsOptions = {
  tools: any[];
  [option: string]: any;
}

export type TextToSpeechResponse = {
  contentType: string;
  content: Buffer;
}

export type MpcTool = {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, any>;
    required: string[];
  };
}

export interface LlmAdapter {

  chatCompletions(
    systemPrompt: string[],
    firstMessages: string[],
    options: ChatCompletionsOptions,
    inProgress?: {
      messages: any[];
      toolResults?: {
        id: string;
        content: string;
      }[];
    }
  ): Promise<ChatCompletionsResponse>;

  textToSpeech(message: string, options: Record<string, any>): Promise<TextToSpeechResponse>;
}