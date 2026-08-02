const express = require('express');
const { ExpressPeerServer } = require('peer');

const app = express();
const PORT = process.env.PORT || 3000;

// CORS 허용
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
});

const server = app.listen(PORT, () => {
    console.log(`Matching Server running on port ${PORT}`);
});

// PeerJS 시그널링 서버
const peerServer = ExpressPeerServer(server, {
    debug: true,
    path: '/'
});

app.use('/peerjs', peerServer);

// 선착순 매칭 대기열 (배열로 안전 관리)
let waitingQueue = [];

// 플레이어 접속 해제 시 대기열 제거
peerServer.on('disconnect', (client) => {
    const disconnectedId = client.getId();
    waitingQueue = waitingQueue.filter(id => id !== disconnectedId);
    console.log(`유저 접속 해제 (대기열 정리 완료): ${disconnectedId}`);
});

// 매칭 요청 API
app.get('/match', (req, res) => {
    const myId = req.query.id;
    if (!myId) return res.status(400).json({ error: "No ID provided" });

    // 이미 대기열에 있다면 중복 방지
    if (!waitingQueue.includes(myId)) {
        waitingQueue.push(myId);
    }

    // 대기열에 2명 이상 모였을 때
    if (waitingQueue.length >= 2) {
        // 첫 번째 유저(호스트)와 두 번째 유저(게스트)
        const hostId = waitingQueue.shift();
        const guestId = waitingQueue.shift();

        // 요청한 유저가 호스트인지 게스트인지 응답
        if (myId === hostId) {
            return res.json({ status: "matched", isHost: true, opponentId: guestId });
        } else if (myId === guestId) {
            return res.json({ status: "matched", isHost: false, opponentId: hostId });
        }
    }

    // 혼자 대기 중인 경우
    res.json({ status: "waiting", isHost: true });
});

// 대기 취소 API
app.get('/cancel-match', (req, res) => {
    const myId = req.query.id;
    waitingQueue = waitingQueue.filter(id => id !== myId);
    res.json({ status: "cancelled" });
});
