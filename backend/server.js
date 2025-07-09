// server.js (als ES-Modul)
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*', 
        methods: ["GET", "POST"]
    }
});

const maps = new Map();

io.on('connection', (socket) => {
    console.log('🟢 Neue Verbindung:', socket.id);

    socket.on('join-map', ({ mapId }) => {
        socket.join(mapId);
        socket.data.mapId = mapId;

        if (!maps.has(mapId)) {
            maps.set(mapId, {
                nodes: [],
                connections: []
            });
        }

        const map = maps.get(mapId);
        socket.emit('initial-sync', {
            nodes: map.nodes
        });

    });
    socket.on('node-added', (data) => {
        const map = maps.get(socket.data.mapId);
        map.nodes.push(data);
        socket.to(socket.data.mapId).emit('node-added', data);
    });

    socket.on('node-moving', (data) => {
        socket.to(socket.data.mapId).emit('node-moving', data);
    });

    socket.on('node-moved', (data) => {
        const map = maps.get(socket.data.mapId);
        const node = map.nodes.find((n) => n.id === data.id);
        if (node) {
            node.x = data.x;
            node.y = data.y;
        }
        socket.to(socket.data.mapId).emit('node-moved', data);
    });

    socket.on('node-deleted', ({ id }) => {
        const map = maps.get(socket.data.mapId);
        map.nodes = map.nodes.filter((n) => n.id !== id);
        map.connections = map.connections.filter((c) => c.fromId !== id && c.toId !== id);
        socket.to(socket.data.mapId).emit('node-deleted', { id });
    });

    socket.on('node-renamed', ({ id, text }) => {
        socket.to(socket.data.mapId).emit('node-renamed', { id, text });
    });

    socket.on('connection-added', ({ fromId, toId }) => {
        const map = maps.get(socket.data.mapId);
        map.connections.push({ fromId, toId });
        socket.to(socket.data.mapId).emit('connection-added', { fromId, toId });
    });

    socket.on('connection-deleted', ({ fromId, toId }) => {
        const map = maps.get(socket.data.mapId);
        map.connections = map.connections.filter(
            (c) => !(c.fromId === fromId && c.toId === toId)
        );
        socket.to(socket.data.mapId).emit('connection-deleted', { fromId, toId });
    });

    socket.on('disconnect', () => {
        const mapId = socket.data.mapId;
        const userId = socket.data.userId;
        if (mapId && userId && maps.has(mapId)) {
            const map = maps.get(mapId);
            delete map.users[userId];
            socket.to(mapId).emit('user-left', { userId });
            console.log(`🔴 ${userId} hat ${mapId} verlassen`);
        }
    });
});

const PORT = process.env.PORT || 3000;
if (process.env.NODE_ENV !== 'test') {
  server.listen(PORT, () => {
    console.log(`🚀 Socket.IO Server läuft auf http://localhost:${PORT}`);
  });
}

export { server, io, maps }; // zum Testen
