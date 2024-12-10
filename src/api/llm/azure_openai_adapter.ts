import { AzureOpenAI } from "openai";
import { OpenAIAdapter } from "./openai_adapter";

export class AzureOpenAIAdapter extends OpenAIAdapter<AzureOpenAI> {

  constructor(
    llmConfig = {
      apiKey: JSON.parse(process.env.APP_SECRETS || "{}").AZURE_OPENAI_API_KEY || process.env.AZURE_OPENAI_API_KEY || "",
      apiModelChat: process.env.AZURE_OPENAI_API_DEPLOYMENT_CHAT!,
      apiModelText2Speech: process.env.AZURE_OPENAI_API_DEPLOYMENT_TEXT2SPEECH!,
      endpoint: process.env.AZURE_OPENAI_ENDPOINT!,
      apiVersion: process.env.OPENAI_API_VERSION!,
    }
  ) {
    const apiClient = new AzureOpenAI({apiKey: llmConfig.apiKey, endpoint: llmConfig.endpoint, apiVersion: llmConfig.apiVersion});
    super(llmConfig, apiClient);
  };
}