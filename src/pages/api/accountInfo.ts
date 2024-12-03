import type { NextApiRequest, NextApiResponse } from "next";
import { errorHandler } from "@/api/error";
import { accountAdapterBuilder } from "@/api/account";

const accountAdapter = accountAdapterBuilder();

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json(errorHandler(`Method ${req.method} Not Allowed`));
  }

  const { userId, accessToken } = req.body;
  if (!userId) {
    return res.status(400).json(errorHandler("No userId provided"));
  }

  try {
    const resObj = await accountAdapter.getAccountInfo(userId, accessToken);
    res.status(200).json(resObj);
  } catch (error) {
    res.status(500).json(errorHandler("[accountInfo] accountInfo failed", error));
  }
}