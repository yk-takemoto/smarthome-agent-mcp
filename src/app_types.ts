export type AccountInfo = {
  userId: string;
  userName: string;
  orgId: string;
  orgName: string;
  llmList: Record<string, string>[];
  translateList: Record<string, string>[];
}
export type OidcTokenInfo = {
  provider: string;
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
}
export type CommonExceptionResponse = {
  message: string;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}
export type ChatResponse = {
  resAssistantMessage: string;
  resToolMessages: {
    content: string;
  }[];
}
export type ChatMessage = {
  content: ChatResponse | string;
  fromUser: boolean;
  error?: CommonExceptionResponse;
}