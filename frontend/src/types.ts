export interface Message {
  id: string;
  role: "user" | "aria";
  text: string;
  emotion?: string;
  intensity?: number;
  tone?: string;
  timestamp: number;
}

export interface AriaResponse {
  type: "response";
  text: string;
  emotion: string;
  intensity: number;
  tone: string;
}

export interface StatusMessage {
  type: "status";
  status: "thinking" | "responding";
}

export interface ErrorMessage {
  type: "error";
  message: string;
}

export type ServerMessage = AriaResponse | StatusMessage | ErrorMessage;
