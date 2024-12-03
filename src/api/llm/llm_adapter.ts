export type FunctionCallingResponse = {
  resAssistantMessage: string;
  resToolMessages: {
    tool_call_id: string;
    role: string;
    content: string;
  }[];
}

export type FunctionCallingOptions = {
  tools: any[];
  [option: string]: any;
}

export type TextToSpeechResponse = {
  contentType: string;
  content: Buffer;
}

export interface LlmAdapter {
  functionCalling(
    functions: { [functionId: string]: Function },
    messages: any[],
    options: FunctionCallingOptions
  ): Promise<FunctionCallingResponse>;

  textToSpeech(message: string, options: Record<string, any>): Promise<TextToSpeechResponse>;
}