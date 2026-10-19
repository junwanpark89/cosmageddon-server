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

// 💡 [변경 1] 대기열과 매칭된 상태를 관리할 변수
// 기존에는 단순히 id만 담는 배열이었으나, 이제 rating과 timestamp를 함께 관리합니다.
let waitingQueue = [];
let activeMatches = {}; 

// 플레이어 접속 해제 시 대기열 제거
peerServer.on('disconnect', (client) => {
    const disconnectedId = client.getId();
    waitingQueue = waitingQueue.filter(p => p.id !== disconnectedId);
    delete activeMatches[disconnectedId]; // 매칭 상태에서도 제거
    console.log(`유저 접속 해제 (대기열 정리 완료): ${disconnectedId}`);
});

// 매칭 요청 API (💡 [변경 2] 레이팅 기반 매칭 알고리즘 적용)
app.get('/match', (req, res) => {
    const myId = req.query.id;
    const myRating = parseInt(req.query.rating) || 1000;
    const now = Date.now();

    if (!myId) return res.status(400).json({ error: "No ID provided" });

    // 1. 이미 매칭이 성사되어 대기 중인 상태인지 확인 (폴링으로 결과를 가져가는 용도)
    if (activeMatches[myId]) {
        const matchInfo = activeMatches[myId];
        delete activeMatches[myId]; // 정보를 읽어갔으면 목록에서 제거
        return res.json({
            status: "matched",
            isHost: matchInfo.isHost,
            opponentId: matchInfo.opponentId
        });
    }

    // 2. 대기열에 기존 내 기록이 있다면 제거 (중복 등록 방지 및 최신 레이팅 갱신)
    waitingQueue = waitingQueue.filter(p => p.id !== myId);

    // 3. 비슷한 레이팅의 상대 찾기
    let matchIndex = -1;
    for (let i = 0; i < waitingQueue.length; i++) {
        const opponent = waitingQueue[i];
        const waitTime = now - opponent.timestamp;
        
        // ⏳ 대기 시간이 길어질수록 매칭 허용 오차 범위를 점차 넓힘 (무한 대기 방지)
        // 기본 ±100점 허용, 3초 지날 때마다 ±50점씩 범위 확장
        const tolerance = 100 + Math.floor(waitTime / 3000) * 50;
        const ratingDiff = Math.abs(myRating - opponent.rating);

        if (ratingDiff <= tolerance) {
            matchIndex = i;
            break;
        }
    }

    // 4. 상대를 찾은 경우
    if (matchIndex !== -1) {
        const opponent = waitingQueue.splice(matchIndex, 1)[0];

        // 먼저 대기하고 있던 사람(opponent)을 Host로, 나중에 들어온 현재 사람을 Guest로 지정
        activeMatches[opponent.id] = { opponentId: myId, isHost: true };

        return res.json({
            status: "matched",
            isHost: false,
            opponentId: opponent.id
        });
    } 
    
    // 5. 상대를 아직 못 찾은 경우 대기열에 등록
    else {
        waitingQueue.push({ id: myId, rating: myRating, timestamp: now });
        return res.json({ status: "waiting" });
    }
});

// 대기 취소 API
app.get('/cancel-match', (req, res) => {
    const myId = req.query.id;
    waitingQueue = waitingQueue.filter(p => p.id !== myId);
    delete activeMatches[myId];
    res.json({ status: "cancelled" });
});
