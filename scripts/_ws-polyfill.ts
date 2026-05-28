import ws from "ws";
if (!globalThis.WebSocket) globalThis.WebSocket = ws as unknown as typeof WebSocket;
