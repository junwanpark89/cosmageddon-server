const express = require('express');
const { ExpressPeerServer } = require('peer');

const app = express();
const PORT = process.env.PORT || 3000;

// CORS 허용 (게임 브라우저 통신용)
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
});

const server = app.listen(PORT, () => {
    console.log(`Matching Server running on port ${PORT}`);
});

// PeerJS 시그널링 서버 생성
const peerServer = ExpressPeerServer(server, {
    debug: true,
    path: '/myapp'
});

app.use('/peerjs', peerServer);

// 선착순 매칭 대기열
let waitingPeerId = null;

app.get('/match', (req, res) => {
    const myId = req.query.id;
    if (!myId) return res.status(400).json({ error: "No ID provided" });

    if (waitingPeerId && waitingPeerId !== myId) {
        // 먼저 온 사람(waitingPeerId)과 방금 온 사람(myId) 매칭!
        const opponentId = waitingPeerId;
        waitingPeerId = null; // 대기열 비우기
        res.json({ status: "matched", opponentId: opponentId, isHost: false });
    } else {
        // 내가 첫 번째 대기자
        waitingPeerId = myId;
        res.json({ status: "waiting", isHost: true });
    }
});
