// WebSocket Realtime Client for Vivora Voice Sessions

export type MessageHandler = (data: any) => void;

export class VivaWebSocketClient {
  private ws: WebSocket | null = null;
  private url: string;
  private handlers: Set<MessageHandler> = new Set();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  constructor(sessionId: string, baseUrl?: string) {
    const defaultWsUrl = process.env.NEXT_PUBLIC_WS_URL || "ws://127.0.0.1:8000";
    this.url = `${baseUrl || defaultWsUrl}/ws/session/${sessionId}`;
  }

  public connect(): void {
    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        console.log("WebSocket connection established to Vivora Gateway");
        this.reconnectAttempts = 0;
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handlers.forEach((handler) => handler(data));
        } catch (e) {
          console.error("Failed to parse incoming WebSocket message:", e);
        }
      };

      this.ws.onerror = (err) => {
        console.error("WebSocket error:", err);
      };

      this.ws.onclose = () => {
        console.log("WebSocket connection closed");
      };
    } catch (e) {
      console.error("WebSocket connection failure:", e);
    }
  }

  public send(type: string, payload: Record<string, any> = {}): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, ...payload }));
    } else {
      console.warn("WebSocket is not connected. Cannot send:", type);
    }
  }

  public onMessage(handler: MessageHandler): () => void {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }

  public disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.handlers.clear();
  }
}
