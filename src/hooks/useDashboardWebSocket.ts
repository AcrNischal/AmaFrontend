import { useEffect, useRef, useState } from "react";
import { WS_BASE_URL } from "../api/config";
import { getAccessToken } from "../api/index.js";

const MIN_RECONNECT_MS = 5000;
const MAX_RECONNECT_MS = 60000;

/**
 * WebSocket for branch manager / super admin dashboards.
 * Pushes a lightweight "refresh" signal; HTTP fetches data (debounced in the page).
 */
export function useDashboardWebSocket(
  branchId: number | string | null | undefined,
  onUpdate: () => void
) {
  const socketRef = useRef<WebSocket | null>(null);
  const onUpdateRef = useRef(onUpdate);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptRef = useRef(0);
  const intentionalCloseRef = useRef(false);
  const [isConnected, setIsConnected] = useState(false);

  onUpdateRef.current = onUpdate;

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
      let wsUrl = branchId
        ? `${WS_BASE_URL}/ws/dashboard/${branchId}/`
        : `${WS_BASE_URL}/ws/dashboard/`;
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
            if (data.type === "dashboard_update") {
              onUpdateRef.current();
            }
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
  }, [branchId]);

  return { socketRef, isConnected };
}
