// socket.js

// Import Socket.IO client from CDN (ES module version)
import { io } from "https://cdn.socket.io/4.8.0/socket.io.esm.min.js";

// Holds the socket connection instance
let socket = null;

/**
 * Initializes the socket connection for a specific mindmap.
 * - Connects to the server
 * - Joins a room for the given map ID
 * - Registers event listeners with the provided handler callbacks
 */
export function initSocket(mapId, handlers) {
    // Connect to socket server (using environment variable or localhost fallback)
    socket = io(import.meta.env.VITE_SOCKET_URL || "http://localhost:3000");

    // Join a specific mindmap room
    socket.emit("join-map", { mapId });

    // Register event listeners for real-time synchronization
    socket.on("initial-sync", handlers.onInitialSync);             // Sync initial state
    socket.on("node-moving", handlers.onNodeMoving);               // Node is being dragged
    socket.on("node-moved", handlers.onNodeMoved);                 // Node drag ended
    socket.on("node-added", handlers.onNodeAdded);                 // New node created
    socket.on("node-deleted", handlers.onNodeDeleted);             // Node removed
    socket.on("connection-added", handlers.onConnectionAdded);     // Connection created
    socket.on("connection-deleted", handlers.onConnectionDeleted); // Connection removed
    socket.on("node-renamed", handlers.onNodeRenamed);             // Node label updated
}

// -------- Emit Wrapper --------

/**
 * Emits a 'node-moving' event with position data during drag.
 */
export function emitNodeMoving(data) {
    socket?.emit("node-moving", data);
}

/**
 * Emits a 'node-moved' event when dragging ends.
 */
export function emitNodeMoved(data) {
    socket?.emit("node-moved", data);
}

/**
 * Emits a 'node-added' event when a new node is created.
 */
export function emitNodeAdded(data) {
    socket?.emit("node-added", data);
}

/**
 * Emits a 'node-deleted' event with the node ID.
 */
export function emitNodeDeleted({ id }) {
    socket?.emit("node-deleted", { id });
}

/**
 * Emits a 'connection-added' event with the IDs of connected nodes.
 */
export function emitConnectionAdded({ fromId, toId }) {
    socket?.emit("connection-added", { fromId, toId });
}

/**
 * Emits a 'connection-deleted' event to remove a connection between nodes.
 */
export function emitConnectionDeleted({ fromId, toId }) {
    socket?.emit("connection-deleted", { fromId, toId });
}

/**
 * Emits a 'node-renamed' event with updated text content for a node.
 */
export function emitNodeRenamed({ id, text }) {
    socket?.emit("node-renamed", { id, text });
}

