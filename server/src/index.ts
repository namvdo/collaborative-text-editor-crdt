import WebSocket from 'ws';
import { createServer } from 'http';
import dotenv from 'dotenv';

dotenv.config();

interface Message {
    type: 'doc-update' | 'user-joined' | 'user-left';
    content: string;
    roomId: string;
}

const server = createServer();
const wss = new WebSocket.Server({ server });

const rooms: Map<string, Set<WebSocket>> = new Map();

wss.on('connection', (ws, req) => {
    const roomId = req.url?.split('/')[1] || 'default-room';

    if (!rooms.has(roomId)) {
        rooms.set(roomId, new Set());
    }
    rooms.get(roomId)!.add(ws);

    const broadcastUserCount = () => {
        const count = rooms.get(roomId)?.size || 0;
        const message: Message = {
            type: 'user-joined',
            content: count.toString(),
            roomId
        };
        broadcast(message);
    };

    const broadcast = (data: Message, sender?: WebSocket) => {
        rooms.get(roomId)?.forEach(client => {
            if (client !== sender && client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify(data));
            }
        });
    };

    ws.on('message', (message: string) => {
        try {
            const data: Message = JSON.parse(message);
            broadcast(data, ws);
        } catch (e) {
            console.error('Failed to parse message:', e);
        }
    });

    ws.on('close', () => {
        rooms.get(roomId)?.delete(ws);
        if (rooms.get(roomId)?.size === 0) {
            rooms.delete(roomId);
        } else {
            broadcastUserCount();
        }
    });

    broadcastUserCount();
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
    console.log(`WebSocket server is running on port ${PORT}`);
});
