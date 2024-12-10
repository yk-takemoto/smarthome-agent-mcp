import React, { createContext, ReactNode, useContext, useState } from "react";
import { useSession } from "next-auth/react";
import { AccountInfo } from "@/app_types";

export type AccountSettingsContextType = {
  accountInfo: AccountInfo | null;
  setAccountInfo: (accountInfo: AccountInfo) => void;
  selectedLlmId: string;
  setSelectedLlmId: (selectedLlmId: string) => void;
  selectedTranslateId: string;
  setSelectedTranslateId: (selectedTranslateId: string) => void;
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
  return (
    <AccountSettingsContext.Provider value={{
      accountInfo,
      setAccountInfo,
      selectedLlmId,
      setSelectedLlmId,
      selectedTranslateId,
      setSelectedTranslateId,
      }}>
      {children}
    </AccountSettingsContext.Provider>
  );
};