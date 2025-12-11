import { WebSocketServer, WebSocket } from "ws";
import { IncomingMessage } from "http";
import { auth } from "./auth.js";

// Store connected clients by userId
// Each user can have multiple connections (multiple tabs/devices)
const clients = new Map<string, Set<WebSocket>>();

// WebSocket server instance
let wss: WebSocketServer | null = null;

/**
 * Initialize WebSocket server
 */
export function initWebSocket(server: any): WebSocketServer {
    wss = new WebSocketServer({ server, path: "/ws" });

    wss.on("connection", async (ws: WebSocket, req: IncomingMessage) => {
        console.log("[WS] New connection attempt");

        // Extract session from cookies
        const cookies = req.headers.cookie || "";
        const userId = await authenticateConnection(cookies);

        if (!userId) {
            console.log("[WS] Authentication failed, closing connection");
            ws.close(4001, "Unauthorized");
            return;
        }

        console.log(`[WS] User ${userId} connected`);

        // Add to clients map
        if (!clients.has(userId)) {
            clients.set(userId, new Set());
        }
        clients.get(userId)!.add(ws);

        // Send welcome message
        ws.send(JSON.stringify({
            type: "connected",
            message: "Connected to notification server",
        }));

        // Handle incoming messages (for future use - e.g., mark as read)
        ws.on("message", (data: Buffer) => {
            try {
                const message = JSON.parse(data.toString());
                handleClientMessage(userId, message, ws);
            } catch (error) {
                console.error("[WS] Invalid message format:", error);
            }
        });

        // Handle disconnection
        ws.on("close", () => {
            console.log(`[WS] User ${userId} disconnected`);
            const userConnections = clients.get(userId);
            if (userConnections) {
                userConnections.delete(ws);
                if (userConnections.size === 0) {
                    clients.delete(userId);
                }
            }
        });

        // Handle errors
        ws.on("error", (error) => {
            console.error(`[WS] Error for user ${userId}:`, error);
        });

        // Heartbeat - ping every 30 seconds
        const pingInterval = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.ping();
            } else {
                clearInterval(pingInterval);
            }
        }, 30000);

        ws.on("close", () => clearInterval(pingInterval));
    });

    console.log("[WS] WebSocket server initialized on /ws");
    return wss;
}

/**
 * Authenticate WebSocket connection using session cookie
 */
async function authenticateConnection(cookies: string): Promise<string | null> {
    try {
        // Parse cookies to get session
        const cookieHeader = new Headers();
        cookieHeader.set("cookie", cookies);

        const session = await auth.api.getSession({ headers: cookieHeader });

        if (session?.user?.id) {
            return session.user.id;
        }
        return null;
    } catch (error) {
        console.error("[WS] Auth error:", error);
        return null;
    }
}

/**
 * Handle messages from client
 */
function handleClientMessage(userId: string, message: any, ws: WebSocket) {
    switch (message.type) {
        case "ping":
            ws.send(JSON.stringify({ type: "pong" }));
            break;
        default:
            console.log(`[WS] Unknown message type from ${userId}:`, message.type);
    }
}

/**
 * Send notification to a specific user (all their connections)
 */
export function sendToUser(userId: string, data: any): boolean {
    const userConnections = clients.get(userId);
    if (!userConnections || userConnections.size === 0) {
        console.log(`[WS] User ${userId} not connected`);
        return false;
    }

    const message = JSON.stringify(data);
    let sent = 0;

    userConnections.forEach((ws) => {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(message);
            sent++;
        }
    });

    console.log(`[WS] Sent to ${sent} connections for user ${userId}`);
    return sent > 0;
}

/**
 * Send notification to multiple users (fanout)
 */
export function sendToUsers(userIds: string[], data: any): { sent: number; offline: number } {
    let sent = 0;
    let offline = 0;

    for (const userId of userIds) {
        if (sendToUser(userId, data)) {
            sent++;
        } else {
            offline++;
        }
    }

    console.log(`[WS] Fanout: ${sent} online, ${offline} offline`);
    return { sent, offline };
}

/**
 * Broadcast to all connected users
 */
export function broadcast(data: any): number {
    const message = JSON.stringify(data);
    let count = 0;

    clients.forEach((connections, userId) => {
        connections.forEach((ws) => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(message);
                count++;
            }
        });
    });

    console.log(`[WS] Broadcast to ${count} connections`);
    return count;
}

/**
 * Get count of connected users
 */
export function getConnectedUsersCount(): number {
    return clients.size;
}

/**
 * Get count of total connections
 */
export function getTotalConnectionsCount(): number {
    let count = 0;
    clients.forEach((connections) => {
        count += connections.size;
    });
    return count;
}

/**
 * Check if a user is online
 */
export function isUserOnline(userId: string): boolean {
    const connections = clients.get(userId);
    return connections !== undefined && connections.size > 0;
}

export { wss, clients };
