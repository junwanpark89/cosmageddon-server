const express = require('express');
const { ExpressPeerServer } = require('peer');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const server = app.listen(process.env.PORT || 443);

// PeerJS 서버 설정
const peerServer = ExpressPeerServer(server, {
    debug: true,
    path: '/peerjs'
});
app.use('/peerjs', peerServer);

// ----------------------------------------------------
// 🎯 Quick Match (무작위 순서 매칭) 대기열 로직
// ----------------------------------------------------
let waitingHostId = null;

app.post('/api/matchmaking', (req, res) => {
    const { peerId } = req.body;

    // 만약 기존 대기 중인 Host가 나가서 무효화되었거나 자기 자신인 경우 리셋
    if (waitingHostId === peerId) {
        return res.json({ status: 'WAITING', hostId: peerId });
    }

    if (waitingHostId) {
        // 1. 이미 기다리고 있는 유저가 있다면 -> 해당 유저와 매칭!
        const matchedHostId = waitingHostId;
        waitingHostId = null; // 대기열 비우기
        return res.json({ status: 'MATCHED', role: 'guest', hostId: matchedHostId });
    } else {
        // 2. 기다리는 유저가 없다면 -> 내가 대기자(Host)가 됨
        waitingHostId = peerId;
        return res.json({ status: 'WAITING', role: 'host', hostId: peerId });
    }
});

// 연결이 끊기거나 취소할 때 대기열 비우기
app.post('/api/cancel-matchmaking', (req, res) => {
    const { peerId } = req.body;
    if (waitingHostId === peerId) {
        waitingHostId = null;
    }
    res.json({ success: true });
});
