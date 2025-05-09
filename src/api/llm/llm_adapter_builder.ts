import { LlmAdapter } from "./llm_adapter";
import { OpenAIAdapter } from "./openai_adapter";
import { AzureOpenAIAdapter } from "./azure_openai_adapter";
import { AnthropicAdapter } from "./anthropic_adapter";
import { GeminiAdapter } from "./gemini_adapter";
import { GroqAdapter } from "./groq_adapter";

type LlmAdapterConstructor = new (...args: any[]) => LlmAdapter;
const llmAdapterClasses: Record<string, LlmAdapterConstructor> = {
  OpenAI: OpenAIAdapter,
  AzureOpenAI: AzureOpenAIAdapter,
  Anthropic: AnthropicAdapter,
  Google: GeminiAdapter,
  Groq: GroqAdapter,
};

const llmAdapterBuilder = (llmId: string): LlmAdapter => {
  const llmAdapterClass = llmAdapterClasses[llmId];
  return new llmAdapterClass();
}
  
export default llmAdapterBuilder;