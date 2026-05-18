import { useEffect, useRef, useState } from "react";
import { WS_BASE_URL } from "../api/config";
import { getAccessToken } from "../api/index.js";

type MessageHandler = (data: { type: string; invoice_id?: string; status?: string }) => void;

const MIN_RECONNECT_MS = 3000;
const MAX_RECONNECT_MS = 30000;

/**
 * WebSocket for waiter/counter order lists.
 * - One connection per mount; stable handler via ref (no reconnect on callback change)
 * - Exponential backoff on failure (avoids reconnect storms when DB/server is down)
 * - Cleans up timers and socket on unmount
 */
export function useOrdersWebSocket(onMessage: MessageHandler) {
  const socketRef = useRef<WebSocket | null>(null);
  const onMessageRef = useRef(onMessage);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptRef = useRef(0);
  const intentionalCloseRef = useRef(false);
  const [isConnected, setIsConnected] = useState(false);

  onMessageRef.current = onMessage;

  useEffect(() => {
    intentionalCloseRef.current = false;

    const clearReconnectTimer = () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };

    const scheduleReconnect = () => {
      if (intentionalCloseRef.current) return;
      clearReconnectTimer();
      const attempt = reconnectAttemptRef.current;
      const delay = Math.min(MIN_RECONNECT_MS * 2 ** attempt, MAX_RECONNECT_MS);
      reconnectAttemptRef.current = attempt + 1;
      reconnectTimerRef.current = setTimeout(connect, delay);
    };

    function connect() {
      if (intentionalCloseRef.current) return;

      const existing = socketRef.current;
      if (existing && (existing.readyState === WebSocket.OPEN || existing.readyState === WebSocket.CONNECTING)) {
        return;
      }

      const token = getAccessToken();
      let wsUrl = WS_BASE_URL + "/ws/orders/";
      if (token) {
        wsUrl += `?token=${token}`;
      }

      try {
        const socket = new WebSocket(wsUrl);

        socket.onopen = () => {
          reconnectAttemptRef.current = 0;
          setIsConnected(true);
        };

        socket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            onMessageRef.current(data);
          } catch {
            // Ignore malformed messages
          }
        };

        socket.onclose = (event) => {
          setIsConnected(false);
          socketRef.current = null;
          if (!intentionalCloseRef.current && !event.wasClean) {
            scheduleReconnect();
          }
        };

        socket.onerror = () => {
          socket.close();
        };

        socketRef.current = socket;
      } catch {
        scheduleReconnect();
      }
    }

    connect();

    return () => {
      intentionalCloseRef.current = true;
      clearReconnectTimer();
      const socket = socketRef.current;
      if (socket) {
        socket.close();
        socketRef.current = null;
      }
      setIsConnected(false);
    };
  }, []);

  return { socketRef, isConnected };
}
