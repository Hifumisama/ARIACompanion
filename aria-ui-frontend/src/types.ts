export interface Message {
  id: string;
  role: "user" | "aria";
  text: string;
  emotion?: string;
  tone?: string;
  timestamp: number;
}

export interface AriaResponse {
  type: "response";
  text: string;
  emotion: string;
  tone: string;
}

export interface StatusMessage {
  type: "status";
  status: "thinking" | "responding" | "streaming" | "idle";
}

export interface TokenMessage {
  type: "token";
  text: string;
  seq: number;
}

export interface InterruptedMessage {
  type: "interrupted";
  reason: string;
}

export interface SttResultMessage {
  type: "stt_result";
  text: string;
}

export interface TtsStartMessage {
  type: "tts_start";
  request_id: string;
}

export interface TtsEndMessage {
  type: "tts_end";
  request_id: string;
}

export interface ErrorMessage {
  type: "error";
  message: string;
}

export type ServerMessage =
  | AriaResponse
  | StatusMessage
  | TokenMessage
  | InterruptedMessage
  | SttResultMessage
  | TtsStartMessage
  | TtsEndMessage
  | ErrorMessage;
