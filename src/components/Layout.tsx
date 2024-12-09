import React, { ReactNode, useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/router";
import { useSession, signIn, signOut } from "next-auth/react";
import {
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Drawer,
  List,
  ListItemButton,
  ListItemText,
  ListItemIcon,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Backdrop,
  CircularProgress,
  Stack
} from "@mui/material";
import { SelectChangeEvent } from "@mui/material/Select";
import MenuIcon from "@mui/icons-material/Menu";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import LogoutIcon from "@mui/icons-material/Logout";
import { useAccountSettings } from "@/contexts/account_settings_context";
import * as account from "@/services/account";

export const Layout = ({ children }: { children: ReactNode }) => {
  const { data: session, status, update } = useSession();
  const [menuDrawerOpen, setMenuDrawerOpen] = useState(false);
  const [accountDrawerOpen, setAccountDrawerOpen] = useState(false);
  const {
    accountInfo, setAccountInfo,
    selectedLlmId, setSelectedLlmId,
    selectedTranslateId, setSelectedTranslateId
  } = useAccountSettings();
  
  const router = useRouter();

  const updateAccountInfo = useCallback(async () => {
    if (!session || accountInfo) {
      return;
    }
    try {
      const res = await account.getAccountInfo(
        session.authedUserId, 
        session.oidcTokenInfo?.accessToken
      );
      setAccountInfo(res);
      if (!selectedLlmId) {
        setSelectedLlmId(session.selectedLlmId || Object.keys(res.llmList[0])[0] || "");
      }
      if (!selectedTranslateId) {
        setSelectedTranslateId(session.selectedTranslateId || "None");
      }
    } catch (error) {
      console.error("Failed to fetch account info:", error);
    }
  }, [
    session,
    accountInfo, setAccountInfo,
    selectedLlmId, setSelectedLlmId,
    selectedTranslateId, setSelectedTranslateId
  ]);

  useEffect(() => {
    if (status === "loading") {
      return;
    }
    if (!session) {
      signIn();
      return;
    }
    updateAccountInfo();
  }, [status, session, updateAccountInfo]);

  const handleLogout = () => {
    signOut();
  };

  const toggleMenuDrawer = () => {
    setMenuDrawerOpen(!menuDrawerOpen);
  };

  const toggleAccountDrawer = () => {
    setAccountDrawerOpen(!accountDrawerOpen);
  };

  const handleMenuClick = (path: string) => {
    router.push(path);
    setMenuDrawerOpen(false);
  };

  const handleLlmChange = async (event: SelectChangeEvent) => {
    const value = event.target.value as string;
    setSelectedLlmId(value);
    await update({
      ...session,
      selectedLlmId: value,
    });
  };

  const handleTranslationChange = async (event: SelectChangeEvent) => {
    const value = event.target.value as string;
    setSelectedTranslateId(value);
    await update({
      ...session,
      selectedTranslateId: value,
    });
  };

  return (status === "loading" || !session) ? (
    <Backdrop sx={{ color: "#fff", zIndex: (theme) => theme.zIndex.drawer + 1 }} open={true}>
      <Stack spacing={2} alignItems="center">
        <CircularProgress color="inherit" />
      </Stack>
    </Backdrop>
  ) : (
    <>
      <AppBar position="static">
        <Toolbar>
          <IconButton edge="start" color="inherit" aria-label="menu" onClick={toggleMenuDrawer}>
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" style={{ flexGrow: 1 }}>
            Smart Home Agent
          </Typography>
          <IconButton edge="end" color="inherit" aria-label="account" onClick={toggleAccountDrawer}>
            <AccountCircleIcon />
          </IconButton>
        </Toolbar>
      </AppBar>
      <Drawer open={menuDrawerOpen} onClose={toggleMenuDrawer}>
        <List>
          <ListItemButton onClick={() => handleMenuClick("/")}>
            <ListItemText primary="チャットでリクエスト" />
          </ListItemButton>
        </List>
      </Drawer>
      <Drawer anchor="right" open={accountDrawerOpen} onClose={toggleAccountDrawer}>
        <div style={{ width: 250, padding: 16 }}>
          <Typography variant="h6">User: {accountInfo?.userName}</Typography>
          <Typography variant="h6">Org : {accountInfo?.orgName}</Typography>
          <FormControl fullWidth style={{ marginTop: 16 }}>
            <InputLabel id="llm-select-label">使用するLLMを選択</InputLabel>
            <Select
              labelId="llm-select-label"
              value={selectedLlmId}
              label="LLM"
              onChange={handleLlmChange}
            >
              {accountInfo?.llmList.map((llm, index) => {
                const key = Object.keys(llm)[0];
                const value = llm[key];
                return (
                  <MenuItem key={index} value={key}>
                    {value}
                  </MenuItem>
                );
              })}
            </Select>
          </FormControl>
          <FormControl fullWidth style={{ marginTop: 16 }}>
            <InputLabel id="translation-select-label">使用する翻訳APIを選択</InputLabel>
            <Select
              labelId="translation-select-label"
              value={selectedTranslateId}
              label="translationAPI"
              onChange={handleTranslationChange}
            >
              <MenuItem key={0} value="None">
                使用しない
              </MenuItem>
              {accountInfo?.translateList.map((translate, index) => {
                const key = Object.keys(translate)[0];
                const value = translate[key];
                return (
                  <MenuItem key={index + 1} value={key}>
                    {value}
                  </MenuItem>
                );
              })}
            </Select>
          </FormControl>
          <List style={{ marginTop: "auto" }}>
            {session && (
              <>
                <ListItemButton onClick={handleLogout}>
                  <ListItemIcon>
                    <LogoutIcon />
                  </ListItemIcon>
                  <ListItemText primary="ログアウト" />
                </ListItemButton>
              </>
            )}
          </List>
        </div>
      </Drawer>
      <main>{children}</main>
    </>
  );
};
