// Managed WebSocket client with exponential backoff reconnection and environment configuration

export function getWebSocketBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_WS_URL) {
    return process.env.NEXT_PUBLIC_WS_URL.replace(/\/$/, "");
  }
  if (typeof window !== "undefined") {
    if (window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1") {
      return "wss://vivora-backend.onrender.com";
    }
    const isSecure = window.location.protocol === "https:";
    const host = window.location.hostname || "127.0.0.1";
    // If running frontend on localhost:3000, default backend ws is on 8000
    const port = window.location.port === "3000" ? "8000" : (window.location.port || (isSecure ? "443" : "80"));
    return `${isSecure ? "wss" : "ws"}://${host}:${port}`;
  }
  return "ws://127.0.0.1:8000";
}

export function getSessionWebSocketUrl(sessionId: string): string {
  const base = getWebSocketBaseUrl();
  return `${base}/ws/session/${sessionId}`;
}

export interface ManagedWebSocketOptions {
  onOpen?: (event: Event) => void;
  onMessage?: (data: any, rawEvent: MessageEvent) => void;
  onError?: (event: Event) => void;
  onClose?: (event: CloseEvent) => void;
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
}

export class ManagedWebSocket {
  private url: string;
  private options: ManagedWebSocketOptions;
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private reconnectTimer: any = null;
  private isExplicitlyClosed = false;

  constructor(url: string, options: ManagedWebSocketOptions = {}) {
    this.url = url;
    this.options = {
      maxRetries: options.maxRetries ?? 5,
      initialDelayMs: options.initialDelayMs ?? 1000,
      maxDelayMs: options.maxDelayMs ?? 16000,
      ...options,
    };
    this.connect();
  }

  private connect(): void {
    if (typeof window === "undefined" || this.isExplicitlyClosed) return;

    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = (event: Event) => {
        this.reconnectAttempts = 0;
        if (this.options.onOpen) {
          this.options.onOpen(event);
        }
      };

      this.ws.onmessage = (event: MessageEvent) => {
        if (this.options.onMessage) {
          try {
            const parsed = JSON.parse(event.data);
            this.options.onMessage(parsed, event);
          } catch (e) {
            this.options.onMessage(event.data, event);
          }
        }
      };

      this.ws.onerror = (event: Event) => {
        if (this.options.onError) {
          this.options.onError(event);
        }
      };

      this.ws.onclose = (event: CloseEvent) => {
        if (this.options.onClose) {
          this.options.onClose(event);
        }
        if (!this.isExplicitlyClosed && this.reconnectAttempts < (this.options.maxRetries || 5)) {
          this.scheduleReconnect();
        }
      };
    } catch (err) {
      console.warn("WebSocket connection initialization failed:", err);
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.isExplicitlyClosed) return;

    const delay = Math.min(
      (this.options.initialDelayMs || 1000) * Math.pow(2, this.reconnectAttempts),
      this.options.maxDelayMs || 16000
    );
    this.reconnectAttempts++;

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }

  public send(data: string | object): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return false;
    }
    const payload = typeof data === "string" ? data : JSON.stringify(data);
    this.ws.send(payload);
    return true;
  }

  public get readyState(): number {
    return this.ws ? this.ws.readyState : WebSocket.CLOSED;
  }

  public get rawSocket(): WebSocket | null {
    return this.ws;
  }

  public close(): void {
    this.isExplicitlyClosed = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      try {
        this.ws.close();
      } catch (e) {}
      this.ws = null;
    }
  }
}
