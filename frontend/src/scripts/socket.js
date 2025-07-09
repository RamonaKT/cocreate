
// socket.js
import { io } from "https://cdn.socket.io/4.8.0/socket.io.esm.min.js";
let socket = null;
export function initSocket(mapId, handlers) {
    socket = io(import.meta.env.VITE_SOCKET_URL || "http://localhost:3000");
    socket.emit("join-map", { mapId });
    socket.on("initial-sync", handlers.onInitialSync);
    socket.on("node-moving", handlers.onNodeMoving);
    socket.on("node-moved", handlers.onNodeMoved);
    socket.on("node-added", handlers.onNodeAdded);
    socket.on("node-deleted", handlers.onNodeDeleted);
    socket.on("connection-added", handlers.onConnectionAdded);
    socket.on("connection-deleted", handlers.onConnectionDeleted);
    socket.on("node-renamed", handlers.onNodeRenamed);
}
// -------- Emit Wrapper --------
export function emitNodeMoving(data) {
    socket?.emit("node-moving", data);
}
export function emitNodeMoved(data) {
    socket?.emit("node-moved", data);
}
export function emitNodeAdded(data) {
    socket?.emit("node-added", data);
}
// erlaubt Übergabe als Objekt:
export function emitNodeDeleted({ id }) {
    socket?.emit("node-deleted", { id });
}

export function emitConnectionAdded({ fromId, toId }) {
    socket?.emit("connection-added", { fromId, toId });
}
export function emitConnectionDeleted({ fromId, toId }) {
    socket?.emit("connection-deleted", { fromId, toId });
}
export function emitNodeRenamed({ id, text }) {
    socket?.emit("node-renamed", { id, text });
}

