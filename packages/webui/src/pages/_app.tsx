import "regenerator-runtime/runtime";
import * as React from "react";
import { AppProps } from "next/app";
import { SessionProvider } from "next-auth/react";
import { CssBaseline, ThemeProvider } from "@mui/material";
import { CacheProvider, EmotionCache } from "@emotion/react";
import createEmotionCache from "../createEmotionCache";
import { theme } from "../theme";
import { AccountSettingsProvider } from "@/contexts/account_settings_context";

interface CustomAppProps extends AppProps {
  emotionCache?: EmotionCache;
}

const clientSideEmotionCache = createEmotionCache();

export default function App({ Component, emotionCache = clientSideEmotionCache, pageProps}: CustomAppProps) {
  return (
    <CacheProvider value={emotionCache}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <SessionProvider>
          <AccountSettingsProvider>
            <Component {...pageProps} />
          </AccountSettingsProvider>
        </SessionProvider>
      </ThemeProvider>
    </CacheProvider>
  );
}