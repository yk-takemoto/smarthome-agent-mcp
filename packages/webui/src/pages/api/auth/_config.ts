import fs from "fs";
import path from "path";
import yaml from "js-yaml";
import { AuthFunctionServer } from "@yk-takemoto/account-manager";

const createAuthServer = () => {
  try {
    const databaseType = process.env.AUTHSERVER_DATABASE_TYPE || "local";
    if (databaseType === "local") {
      if (!process.env.ORGANIZATION_YAML || !process.env.USER_YAML) {
        const accountEnv = process.env.AUTHSERVER_ACCOUNT_ENV || "local";
        const orgYaml = yaml.load(
          fs.readFileSync(path.join(process.cwd(), "org.yaml"), "utf8"),
        );
        const userYaml = yaml.load(
          fs.readFileSync(
            path.join(process.cwd(), `user.${accountEnv}.yaml`),
            "utf8",
          ),
        );
        process.env.ORGANIZATION_YAML = JSON.stringify(orgYaml);
        process.env.USER_YAML = JSON.stringify(userYaml);
      }
    }

    return new AuthFunctionServer();
  } catch (error) {
    throw error;
  }
};

const authConfig = {
  authSecret:
    JSON.parse(process.env.APP_SECRETS || "{}").NEXTAUTH_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    "",
  cognitoClientId: process.env.COGNITO_CLIENT_ID || "",
  cognitoClientSecret:
    JSON.parse(process.env.APP_SECRETS || "{}").COGNITO_CLIENT_SECRET ||
    process.env.COGNITO_CLIENT_SECRET ||
    "",
  cognitoIssuer: process.env.COGNITO_ISSUER,
};

export { authConfig, createAuthServer };
