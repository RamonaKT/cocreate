// server.js (as ES module)

import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
app.use(cors()); // Allow cross-origin requests

const server = http.createServer(app);

// Create a new Socket.IO server with CORS configuration
const io = new Server(server, {
    cors: {
        origin: '*', 
        methods: ["GET", "POST"]
    }
});

// In-memory map storage: mapId => { nodes, connections }
const maps = new Map();

// Handle new client connections
io.on('connection', (socket) => {
    console.log(' New connection:', socket.id);

    // Join a specific mindmap room
    socket.on('join-map', ({ mapId }) => {
        socket.join(mapId); // Join Socket.IO room
        socket.data.mapId = mapId; // Store map ID in socket session

        // Initialize the map data if it doesn't exist yet
        if (!maps.has(mapId)) {
            maps.set(mapId, {
                nodes: [],
                connections: []
            });
        }

        // Send current state (nodes only) to the newly connected client
        const map = maps.get(mapId);
        socket.emit('initial-sync', {
            nodes: map.nodes
        });
    });

    // Broadcast new node to all clients (except sender)
    socket.on('node-added', (data) => {
        const map = maps.get(socket.data.mapId);
        map.nodes.push(data);
        socket.to(socket.data.mapId).emit('node-added', data);
    });

    // Realtime preview of node movement
    socket.on('node-moving', (data) => {
        socket.to(socket.data.mapId).emit('node-moving', data);
    });

    // Final position of moved node
    socket.on('node-moved', (data) => {
        const map = maps.get(socket.data.mapId);
        const node = map.nodes.find((n) => n.id === data.id);
        if (node) {
            node.x = data.x;
            node.y = data.y;
        }
        socket.to(socket.data.mapId).emit('node-moved', data);
    });

    // Remove node and its related connections
    socket.on('node-deleted', ({ id }) => {
        const map = maps.get(socket.data.mapId);
        map.nodes = map.nodes.filter((n) => n.id !== id);
        map.connections = map.connections.filter((c) => c.fromId !== id && c.toId !== id);
        socket.to(socket.data.mapId).emit('node-deleted', { id });
    });

    // Broadcast node renaming to others
    socket.on('node-renamed', ({ id, text }) => {
        socket.to(socket.data.mapId).emit('node-renamed', { id, text });
    });

    // Add a connection (edge) between two nodes
    socket.on('connection-added', ({ fromId, toId }) => {
        const map = maps.get(socket.data.mapId);
        map.connections.push({ fromId, toId });
        socket.to(socket.data.mapId).emit('connection-added', { fromId, toId });
    });

    // Remove a connection between nodes
    socket.on('connection-deleted', ({ fromId, toId }) => {
        const map = maps.get(socket.data.mapId);
        map.connections = map.connections.filter(
            (c) => !(c.fromId === fromId && c.toId === toId)
        );
        socket.to(socket.data.mapId).emit('connection-deleted', { fromId, toId });
    });

    // Handle client disconnecting from the server
    socket.on('disconnect', () => {
        const mapId = socket.data.mapId;
        const userId = socket.data.userId;
        if (mapId && userId && maps.has(mapId)) {
            const map = maps.get(mapId);
            delete map.users[userId]; // Remove user from map's user list
            socket.to(mapId).emit('user-left', { userId });
            console.log(` ${userId} left ${mapId}`);
        }
    });
});

// Start the server if not in test mode
const PORT = process.env.PORT || 3000;
if (process.env.NODE_ENV !== 'test') {
    server.listen(PORT, () => {
        console.log(`Socket.IO server running at http://localhost:${PORT}`);
    });
}

export { server, io, maps }; // Export for testing purposes
