import NextAuth, { AuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import CognitoProvider from "next-auth/providers/cognito";
import { accountAdapterBuilder, accountEnv } from "@/api/account";
import { OidcTokenInfo } from "@/app_types";

const authConfig = {
  authSecret: JSON.parse(process.env.APP_SECRETS || "{}").NEXTAUTH_SECRET || process.env.NEXTAUTH_SECRET || "",
  cognitoClientId: process.env.COGNITO_CLIENT_ID || "",
  cognitoClientSecret: JSON.parse(process.env.APP_SECRETS || "{}").COGNITO_CLIENT_SECRET || process.env.COGNITO_CLIENT_SECRET || "",
  cognitoIssuer: process.env.COGNITO_ISSUER,
}

const authOptions: AuthOptions = (accountEnv === "local") ? {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        if (!credentials?.username || !credentials?.password) {
          return null;
        }
        const accountAdapter = accountAdapterBuilder();
        const authedUserId = await accountAdapter.authByCredentials(
          credentials.username,
          credentials.password
        );
        return authedUserId ? { id: authedUserId } : null;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, account }) {
      // debug
      // console.log("callbacks.jwt token: ", token);
      // console.log("callbacks.jwt user: ", user);
      // console.log("callbacks.jwt account: ", account);
      //
      if (user) {
        token = { ...token, authedUserId: user.id };
      }
      //
      return token;
    },
    async session({ session, token }) {
      // debug
      // console.log("callbacks.session session: ", session);
      // console.log("callbacks.session token: ", token);
      //
      session.authedUserId = token.authedUserId;
      return session;
    },
  },
  secret: authConfig.authSecret,
} : {
  providers: [
    CognitoProvider({
      clientId: authConfig.cognitoClientId,
      clientSecret: authConfig.cognitoClientSecret,
      issuer: authConfig.cognitoIssuer,
    }),
  ],
  callbacks: {
    async jwt({ token, user, account }) {
      // debug
      // console.log("callbacks.jwt token: ", token);
      // console.log("callbacks.jwt user: ", user);
      // console.log("callbacks.jwt account: ", account);
      //
      if (user) {
        token = { ...token, authedUserId: user.id };
      }
      if (account?.access_token && account?.refresh_token && account?.token_type) {
        token = {
          ...token,
          oidcTokenInfo: {
            provider: account.provider,
            accessToken: account.access_token,
            refreshToken: account.refresh_token,
            tokenType: account.token_type,
            expiresIn: 0
          }
        };
      }
      return token;
    },
    async session({ session, token }) {
      // debug
      // console.log("callbacks.session session: ", session);
      // console.log("callbacks.session token: ", token);
      //
      session.authedUserId = token.authedUserId;
      const oidcTokenInfo = token.oidcTokenInfo && token.exp && {
        ...token.oidcTokenInfo,
        expiresIn: token.exp as number
      };
      session.oidcTokenInfo = oidcTokenInfo as OidcTokenInfo;
      // debug
      // console.log("callbacks.session after session: ", session);
      //
      return session;
    },
    redirect({ url, baseUrl }) {
      return url.startsWith(baseUrl) ? url : baseUrl;
    },
  },
  session: {
    strategy: "jwt",
  },
  secret: authConfig.authSecret,
  // debug: true,
  // logger: {
  //   error(code, metadata) {
  //     console.error(`[next-auth][error][${code}]`, metadata);
  //   },
  //   warn(code) {
  //     console.warn(`[next-auth][warn][${code}]`);
  //   },
  //   debug(code, metadata) {
  //     console.log(`[next-auth][debug][${code}]`, metadata);
  //   },
  // },
};

export default NextAuth(authOptions);