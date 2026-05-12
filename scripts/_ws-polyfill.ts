import ws from "ws";
// @ts-ignore
if (!globalThis.WebSocket) globalThis.WebSocket = ws as any;
