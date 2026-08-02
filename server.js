const express = require('express');
const http = require('http');
const { ExpressPeerServer } = require('peer');
const cors = require('cors');

const app = express();
app.use(cors()); // CORS 전면 허용
app.use(express.json());

const server = http.createServer(app);

// PeerJS 서버 마운트
const peerServer = ExpressPeerServer(server, {
    debug: true,
    path: '/peerjs'
});

app.use('/peerjs', peerServer);

// 큐 기반 매칭 시스템
let waitingHostId = null;

app.post('/api/matchmaking', (req, res) => {
    const { peerId } = req.body;
    
    if (!peerId) {
        return res.status(400).json({ error: "peerId is required" });
    }

    if (!waitingHostId || waitingHostId === peerId) {
        waitingHostId = peerId;
        return res.json({ role: 'host' });
    } else {
        const hostId = waitingHostId;
        waitingHostId = null; // 매칭 성공 시 큐 비우기
        return res.json({ role: 'guest', hostId: hostId });
    }
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
