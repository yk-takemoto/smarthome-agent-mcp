import React, { createContext, ReactNode, useContext, useState } from "react";
import { useSession } from "next-auth/react";
import { AccountInfo } from "@yk-takemoto/account-manager";

export type AccountSettingsContextType = {
  accountInfo: AccountInfo | null;
  setAccountInfo: (accountInfo: AccountInfo) => void;
  selectedLlmId: string;
  setSelectedLlmId: (selectedLlmId: string) => void;
  selectedTranslateId: string;
  setSelectedTranslateId: (selectedTranslateId: string) => void;
  tools: any[];
  setTools: (tools: any[]) => void;
};

const AccountSettingsContext = createContext<AccountSettingsContextType | undefined>(undefined);

export const useAccountSettings = () => {
  const context = useContext(AccountSettingsContext);
  if (!context) {
    throw new Error("useAccountSettings must be used within a AccountSettingsProvider");
  }
  return context;
};

export const AccountSettingsProvider = ({ children }: { children: ReactNode }) => {
  const { data: session } = useSession();
  const [accountInfo, setAccountInfo] = useState<AccountInfo | null>(null);
  const [selectedLlmId, setSelectedLlmId] = useState(session?.selectedLlmId || "");
  const [selectedTranslateId, setSelectedTranslateId] = useState(session?.selectedTranslateId || "");
  const [tools, setTools] = useState<any[]>([]);
  return (
    <AccountSettingsContext.Provider value={{
      accountInfo,
      setAccountInfo,
      selectedLlmId,
      setSelectedLlmId,
      selectedTranslateId,
      setSelectedTranslateId,
      tools,
      setTools,
      }}>
      {children}
    </AccountSettingsContext.Provider>
  );
};