import { useEffect, useRef, useCallback } from "react";
import { WS_BASE_URL } from "../api/config";

type MessageHandler = (data: { type: string; branch_id?: string; message?: string }) => void;

export function useDashboardWebSocket(branchId: number | string | null | undefined, onUpdate: () => void) {
    const socketRef = useRef<WebSocket | null>(null);

    const connect = useCallback(() => {
        // If branchId is null/undefined, it's global
        const wsUrl = branchId
            ? `${WS_BASE_URL}/ws/dashboard/${branchId}/`
            : `${WS_BASE_URL}/ws/dashboard/`;

        console.log(`[WS] Attempting to connect to ${wsUrl}`);
        const socket = new WebSocket(wsUrl);

        socket.onopen = () => {
            console.log(`[WS] Dashboard socket connected successfully (${branchId ? 'branch:' + branchId : 'global'})`);
        };

        socket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.type === "dashboard_update") {
                    console.log("[WS] Dashboard update signal received, triggering UI refresh...");
                    onUpdate();
                }
            } catch (err) {
                console.error("[WS] Failed to parse dashboard message:", err);
            }
        };

        socket.onclose = (event) => {
            if (event.wasClean) {
                console.log(`[WS] Dashboard socket closed cleanly, code=${event.code} reason=${event.reason}`);
            } else {
                console.warn(`[WS] Dashboard socket connection died (code: ${event.code}). Retrying in 5s...`);
            }
            setTimeout(connect, 5000);
        };

        socket.onerror = (err) => {
            console.error("[WS] Dashboard socket encountered an error:", err);
            socket.close();
        };

        socketRef.current = socket;
    }, [branchId, onUpdate]);

    useEffect(() => {
        connect();

        return () => {
            if (socketRef.current) {
                socketRef.current.close();
            }
        };
    }, [connect]);

    return socketRef;
}
