import React, { useEffect, useRef, useState } from "react";
import { Box, TextField, IconButton, List, ListItem, ListItemText, Paper, Typography, Button, Collapse, Table, TableBody, TableRow, TableCell } from "@mui/material";
import { Send, Mic, VolumeUp, SmartToy, ExpandLess, ExpandMore } from "@mui/icons-material";
import SpeechRecognition, { useSpeechRecognition } from "react-speech-recognition";
import { Layout } from "@/components/Layout";
import { useAccountSettings } from "@/contexts/account_settings_context";
import { CommonExceptionResponse, ChatResponse, ChatMessage } from "@/app_types";
import * as chat from "@/services/chat";

const ChatApp = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([{
    content: "こんにちは！Smart Home AIアシスタントです。\n操作したい家電製品と操作内容を指示してください。",
    fromUser: false
  }]);
  const [messageDetailExpanded, setMessageDetailExpanded] = useState<boolean[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [enableSpeech, setEnableSpeech] = useState(false);
  const audioPlayerRef = useRef<HTMLAudioElement>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const { transcript, resetTranscript } = useSpeechRecognition();
  const { accountInfo, selectedLlmId, selectedTranslateId } = useAccountSettings();

  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
    setMessageDetailExpanded(Array(messages.length).fill(false));
  }, [messages]);

  const handleSend = async (message: string, fromUser: boolean) => {
    if (!accountInfo || !message) {
      return;
    }
    setMessages((prevMessages) => [...prevMessages, { content: message, fromUser }]);
    if (fromUser) {
      try {
        const resChatResponse = await chat.requestOperation(
          accountInfo,
          message,
          selectedLlmId,
          selectedTranslateId
        );
        setMessages((prevMessages) => [...prevMessages,
          { content: resChatResponse, fromUser: false },
        ]);
        if (enableSpeech) {
          const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
          const url = await chat.textToSpeech(
            accountInfo,
            resChatResponse.resAssistantMessage,
            isIOS ? "aac" : "wav",
            selectedLlmId
          );
          setAudioUrl(url);
        }
      } catch (error) {
        setMessages((prevMessages) => [...prevMessages,
          { content: "システムエラーが発生しました", fromUser: false, error: error as CommonExceptionResponse },
        ]);
      }
    }
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setInput(event.target.value);
  };

  const handleInputKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter") {
      handleInputSend();
    }
  };

  const handleInputSend = async () => {
    if (!input) {
      return;
    }
    const message = String(input).trim();
    setInput("");
    await handleSend(message, true);
  };

  const handleRecStart = () => {
    SpeechRecognition.startListening({ continuous: false });
  };

  const handleRecStop = async () => {
    SpeechRecognition.stopListening();
    await handleSend(transcript, true);
    resetTranscript();
  };

  const handleMic = () => {
    if (isRecording) {
      handleRecStop();
    } else {
      handleRecStart();
    }
    setIsRecording(prevStatus => !prevStatus);
  };

  const handleAudioPlayEnded = () => {
    setAudioUrl(null);
  };

  const handleMessageDetailExpand = (index: number) => {
    setMessageDetailExpanded(prevState =>
      prevState.map((value, i) => (i === index ? !value : value))
    );
  };

  const renderContentWithLineBreaks = (chatMessage: ChatMessage) => {
    const content = typeof chatMessage.content === "string" ? chatMessage.content : (chatMessage.content as ChatResponse).resAssistantMessage;
    return content.split("\n").map((line, index) => (
      <React.Fragment key={index}>
        {line}
        <br />
      </React.Fragment>
    ));
  };

  const needDetail = (chatMessage: ChatMessage) => {
    return chatMessage.error || (typeof chatMessage.content !== "string" && (chatMessage.content as ChatResponse).resToolMessages.length > 0);
  }

  return (
    <Layout>
      <Paper sx={{ width: "100%", height: "90vh", margin: "0 auto", padding: 2, display: "flex", flexDirection: "column" }}>
        <List sx={{ flexGrow: 1, overflow: "auto", backgroundColor: "#f0f0f0" }}>
          {messages.map((message, index) => (
            <ListItem
              key={index}
              sx={{
                display: "flex",
                alignItems: "flex-start",
              }}
            >
              {!message.fromUser && (
                <SmartToy sx={{ marginRight: 1 }} />
              )}
              <ListItemText
                primary={
                  <Typography
                    component="div"
                    align={message.fromUser ? "right" : "left"}
                    sx={{
                      backgroundColor: message.fromUser ? "#dcf8c6" : "#fff",
                      borderRadius: 2,
                      padding: 1,
                      maxWidth: "75%",
                      marginLeft: message.fromUser ? "auto" : 0,
                      marginRight: message.fromUser ? 0 : "auto",
                    }}
                  >
                    <Box mb={1}>
                      {renderContentWithLineBreaks(message)}
                    </Box>
                    {needDetail(message) && (
                      <>
                        <Box sx={messageDetailExpanded[index] ? {mb: 1} : {}}>
                          <Button
                            variant="text"
                            onClick={() => handleMessageDetailExpand(index)}
                            aria-expanded={messageDetailExpanded[index]}
                            endIcon={messageDetailExpanded[index] ? <ExpandLess /> : <ExpandMore />}
                          >
                            詳細
                          </Button>
                        </Box>
                        <Collapse in={messageDetailExpanded[index]} timeout="auto" unmountOnExit>
                          {message.error ? (
                            JSON.stringify(message.error)
                          ) : (message.content as ChatResponse).resToolMessages.map((toolMessage, toolIndex) => {
                            const contentObj = JSON.parse(toolMessage.content);
                            return (
                              <Table key={toolIndex} size="small" sx={{ mb: 1 }}>
                                <TableBody>
                                  {Object.entries(contentObj).map(([key, value], rowIndex) => (
                                    <TableRow key={rowIndex}>
                                      <TableCell>{key}</TableCell>
                                      <TableCell>{value && typeof value === "object" ? JSON.stringify(value) : String(value)}</TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            );
                          })}
                        </Collapse>
                      </>
                    )}
                  </Typography>
                }
              />
            </ListItem>
          ))}
          <div ref={bottomRef} />
        </List>
        <Box sx={{ display: "flex", alignItems: "center", mt: 2 }}>
          <TextField
            variant="outlined"
            fullWidth
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleInputKeyDown}
            placeholder="メッセージを入力"
          />
          <IconButton color="primary" onClick={handleInputSend}>
            <Send />
          </IconButton>
          <IconButton color={isRecording ? "error" : "primary"} onClick={handleMic}>
            <Mic />
          </IconButton>
          <IconButton color={enableSpeech ? "error" : "primary"} onClick={() => { setEnableSpeech(prevState => !prevState) }} >
            <VolumeUp />
          </IconButton>
          {audioUrl && (
            <audio ref={audioPlayerRef} src={audioUrl} onEnded={handleAudioPlayEnded} autoPlay />
          )}
        </Box>
      </Paper>
    </Layout>
  );
};

export default ChatApp;
