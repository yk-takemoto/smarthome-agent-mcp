import { AccountInfo, CommonExceptionResponse } from "@/app_types";

export const getAccountInfo = async (userId: string, accessToken?: string): Promise<AccountInfo> => {
  const formData = {
    userId,
    accessToken
  };
  const response = await fetch(`/api/accountInfo`, {
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

  const resObj: AccountInfo = await response.json();
  return resObj;
};
