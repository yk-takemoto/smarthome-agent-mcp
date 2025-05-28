import {
  AccountInfo,
  ChatResponse,
  CommonExceptionResponse,
} from "@/app_types";

export const initialize = async (account: AccountInfo): Promise<any[]> => {
  const formData = {
    userId: account.userId,
  };
  const response = await fetch(`/api/${account.orgId}/initialize`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(formData),
  });

  if (!response.ok) {
    const errorRes: CommonExceptionResponse = await response.json();
    throw errorRes;
  }

  const resObj: any[] = await response.json();
  return resObj;
};

export const requestOperation = async (
  account: AccountInfo,
  tools: any[],
  requestMessage: string,
  requestLlmId?: string,
  requestTranslateId?: string,
): Promise<ChatResponse> => {
  const formData = {
    userId: account.userId,
    tools,
    requestMessage,
    requestLlmId,
    requestTranslateId,
  };
  const response = await fetch(`/api/${account.orgId}/requestOperation`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(formData),
  });

  if (!response.ok) {
    const errorRes: CommonExceptionResponse = await response.json();
    throw errorRes;
  }

  const resObj: ChatResponse = await response.json();
  return resObj;
};

export const textToSpeech = async (
  account: AccountInfo,
  requestMessage: string,
  responseFormat: string,
  requestLlmId?: string,
): Promise<string> => {
  const formData = {
    userId: account.userId,
    requestMessage: requestMessage,
    responseFormat: responseFormat,
    requestLlmId: requestLlmId,
  };
  const response = await fetch(`/api/${account.orgId}/textToSpeech`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(formData),
  });

  if (!response.ok) {
    const errorRes: CommonExceptionResponse = await response.json();
    throw errorRes;
  }

  const blob = await response.blob();
  const objectURL = URL.createObjectURL(blob);
  return objectURL;
};

export const terminate = async (account: AccountInfo): Promise<void> => {
  const formData = {
    userId: account.userId,
  };
  const response = await fetch(`/api/${account.orgId}/terminate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(formData),
  });

  if (!response.ok) {
    const errorRes: CommonExceptionResponse = await response.json();
    throw errorRes;
  }
};
