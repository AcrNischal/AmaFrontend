import { useEffect, useRef, useCallback, useState } from "react";
import { WS_BASE_URL } from "../api/config";

export function useDashboardWebSocket(branchId: number | string | null | undefined, onUpdate: () => void) {
    const socketRef = useRef<WebSocket | null>(null);
    const [isConnected, setIsConnected] = useState(false);

    const connect = useCallback(() => {
        const wsUrl = branchId
            ? `${WS_BASE_URL}/ws/dashboard/${branchId}/`
            : `${WS_BASE_URL}/ws/dashboard/`;

        console.log(`[WS] Attempting to connect to ${wsUrl}`);
        const socket = new WebSocket(wsUrl);

        socket.onopen = () => {
            console.log(`[WS] Dashboard socket connected successfully`);
            setIsConnected(true);
        };

        socket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.type === "dashboard_update") {
                    console.log("[WS] Dashboard update received");
                    onUpdate();
                }
            } catch (err) {
                console.error("[WS] Failed to parse message:", err);
            }
        };

        socket.onclose = () => {
            setIsConnected(false);
            console.warn(`[WS] Socket connection closed. Retrying in 5s...`);
            setTimeout(connect, 5000);
        };

        socket.onerror = (err) => {
            console.error("[WS] Socket error:", err);
            socket.close();
        };

        socketRef.current = socket;
    }, [branchId, onUpdate]);

    useEffect(() => {
        connect();
        return () => socketRef.current?.close();
    }, [connect]);

    return { socketRef, isConnected };
}
