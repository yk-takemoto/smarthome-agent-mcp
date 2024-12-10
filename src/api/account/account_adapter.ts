export type AccountInfo = {
  userId: string;
  userName: string;
  orgId: string;
  orgName: string;
  llmList: Record<string, string>[];
  translateList: Record<string, string>[];
}

export const accountEnv = process.env.ACCOUNT_ENV || "local";

export interface AccountAdapter {
  authByCredentials(loginId: string, loginPass: string): Promise<string | null>;
  getAccountInfo(userId: string, accessToken?: string): Promise<AccountInfo>;
}