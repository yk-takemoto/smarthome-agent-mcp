import * as yaml from "js-yaml";
import * as fs from "fs";
import path from "path";
import { jwtDecode } from "jwt-decode";
import { AccountAdapter, AccountInfo, accountEnv } from "./account_adapter";

type Users = {
  [userId: string]: {
    display_name: string;
    organization: string;
  }
}
type Orgs = {
  [orgId: string]: {
    display_name: string;
    llm_apis: Record<string, string>[];
    translate_apis: Record<string, string>[];
  }
}

export class YamlAdapter implements AccountAdapter {

  private users;
  private organizations;

  constructor() {
    this.users = yaml.load(fs.readFileSync(path.resolve(`user.${accountEnv}.yaml`), "utf-8")) as Users;
    this.organizations = yaml.load(fs.readFileSync(path.resolve("org.yaml"), "utf-8")) as Orgs;
  };

  async authByCredentials(userId: string, _: string): Promise<string | null> {
    const userInfo = this.users[userId];
    // Currently, there is no password verification
    if (!userInfo) {
      return null;
    }
    return userId;
  }

  private tokenUser(accessToken: string): string | null {
    const decoded = jwtDecode(accessToken);
    return decoded?.sub || null;
  }

  async getAccountInfo(userId: string, accessToken?: string): Promise<AccountInfo> {
    const authedUserId = accessToken ? this.tokenUser(accessToken) : userId;
    if (!authedUserId) {
      throw new Error("Invalid access token");
    } 
    const userInfo = this.users[authedUserId];
    if (!userInfo) {
      throw new Error("The user information of the authorized user does not exist in the database");
    }
    if (!this.organizations[userInfo.organization]) {
      throw new Error("The organization information of the authorized user does not exist in the database");
    }
    return {
      userId: userId,
      userName: userInfo.display_name,
      orgId: userInfo.organization,
      orgName: this.organizations[userInfo.organization].display_name,
      llmList: this.organizations[userInfo.organization].llm_apis,
      translateList: this.organizations[userInfo.organization].translate_apis
    };
  }
}