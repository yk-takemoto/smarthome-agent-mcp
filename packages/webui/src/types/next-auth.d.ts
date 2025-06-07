import NextAuth from "next-auth";
import { AccountInfo, OidcTokenInfo } from "@/app_types";

type OidcTokenInfo = {
  provider: string;
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
};

declare module "next-auth" {
  interface Session {
    authedUserId: string;
    oidcTokenInfo?: OidcTokenInfo;
    selectedLlmId?: string;
    selectedTranslateId?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    authedUserId: string;
    oidcTokenInfo?: OidcTokenInfo;
    selectedLlmId?: string;
    selectedTranslateId?: string;
  }
}
