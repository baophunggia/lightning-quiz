import React, { useState, useEffect, useRef } from 'react';
import { Zap, Timer, RotateCcw, Play, Loader2, Medal } from 'lucide-react';

const WebApp = window.Telegram?.WebApp || {
  initDataUnsafe: { user: { first_name: "Player", username: "tester", id: 123456789 } },
  ready: () => { }, expand: () => { },
  HapticFeedback: { impactOccurred: () => { }, notificationOccurred: () => { } }
};

export default function App() {
  const [gameState, setGameState] = useState('menu');
  const [timeLeft, setTimeLeft] = useState(60);

  const [questionsList, setQuestionsList] = useState([]);
  const [qIndex, setQIndex] = useState(0); // Con trỏ đang trỏ tới câu nào trong mảng 30 câu

  const [currentStreak, setCurrentStreak] = useState(0);
  const [maxStreak, setMaxStreak] = useState(0);

  const [feedback, setFeedback] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  // Dùng useRef để lưu log vì nó thay đổi liên tục, tránh re-render không cần thiết
  const actionLogs = useRef([]);
  const gameStartTime = useRef(0);

  const [leaderboardData, setLeaderboardData] = useState([]);
  const [userRank, setUserRank] = useState(null);
  const [userFinalScore, setUserFinalScore] = useState(0);

  const user = WebApp.initDataUnsafe?.user;

  // Xử lý đếm ngược độc lập
  useEffect(() => {
    let timer;
    if (gameState === 'playing' && timeLeft > 0 && maxStreak < 10) {
      timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
    } else if ((timeLeft === 0 || maxStreak >= 10) && gameState === 'playing') {
      endGame();
    }
    return () => clearInterval(timer);
  }, [gameState, timeLeft, maxStreak]);

  const startGame = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/get-questions');
      const data = await res.json();
      setQuestionsList(data);
    } catch (err) {
      console.error("Lỗi lấy câu hỏi");
    } finally {
      setIsLoading(false);
      setQIndex(0);
      setCurrentStreak(0);
      setMaxStreak(0);
      setTimeLeft(60);
      actionLogs.current = []; // Xóa log cũ
      gameStartTime.current = Date.now();
      setGameState('playing');
    }
  };

  const handleAnswer = (selectedAns) => {
    if (feedback !== null || !currentQ) return;

    const isCorrect = selectedAns === currentQ.a;
    setFeedback({ selected: selectedAns, isCorrect });

    // Ghi log hành động để gửi cho Server kiểm duyệt
    actionLogs.current.push({
      questionId: currentQ.id,
      selectedAns: selectedAns,
      timestamp: Date.now()
    });

    if (isCorrect) {
      if (WebApp.HapticFeedback) WebApp.HapticFeedback.impactOccurred('light');
      const newStreak = currentStreak + 1;
      setCurrentStreak(newStreak);
      if (newStreak > maxStreak) setMaxStreak(newStreak);
    } else {
      if (WebApp.HapticFeedback) WebApp.HapticFeedback.notificationOccurred('error');
      setCurrentStreak(0); // Trả lời sai -> Rớt chuỗi về 0
    }

    // Chuyển sang câu tiếp theo trong mảng sau 500ms
    setTimeout(() => {
      setFeedback(null);
      setQIndex(prev => prev + 1);
    }, 500);
  };

  const endGame = async () => {
    setGameState('gameover');
    setIsLoading(true);

    try {
      const payload = {
        telegram_id: user?.id,
        username: user?.username || 'unknown',
        first_name: user?.first_name || 'Player',
        logs: actionLogs.current,
        startTime: gameStartTime.current
      };

      const res = await fetch('/api/submit-game', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const data = await res.json();
        setLeaderboardData(data.leaderboard || []);
        setUserRank(data.user_rank);
        setUserFinalScore(data.final_score);
      }
    } catch (err) {
      console.error("Lỗi lưu điểm:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const currentQ = questionsList[qIndex];

  // Component hiển thị thang điểm hiện tại
  const LevelLadder = () => (
    <div className="w-16 bg-gray-900/50 rounded-xl p-2 flex flex-col-reverse justify-between border border-gray-800">
      {[...Array(10)].map((_, i) => {
        const level = i + 1;
        const isCurrent = level === (currentStreak + 1); // Đang đứng ở bậc chuẩn bị trả lời
        const isPassed = level <= currentStreak;
        return (
          <div key={level} className={`flex items-center justify-center h-8 text-sm font-bold rounded-lg transition-all ${isCurrent ? 'bg-yellow-500 text-black scale-110' : isPassed ? 'bg-green-500/20 text-green-400' : 'text-gray-500'}`}>
            {level}
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-yellow-500/30 flex flex-col">
      <header className="flex justify-between items-center p-4 border-b border-gray-800 bg-black/80 backdrop-blur sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <div className="bg-yellow-500 p-1.5 rounded-lg"><Zap size={20} className="text-black fill-current" /></div>
          <span className="font-bold text-lg tracking-tight">Lightning Trivia</span>
        </div>
      </header>

      <main className="flex-1 flex flex-col p-4 max-w-md mx-auto w-full relative">
        {gameState === 'menu' && (
          <div className="flex-1 flex flex-col items-center justify-center text-center animate-in fade-in zoom-in duration-300">
            {/* Menu UI */}
            <h1 className="text-4xl font-extrabold mt-6 mb-2 uppercase text-transparent bg-clip-text bg-gradient-to-br from-yellow-400 to-yellow-600">
              Reach Level 10
            </h1>
            <p className="text-gray-400 mb-8 px-4">Answer 10 questions correctly in a row. Fast answers get higher ranks!</p>
            <button onClick={startGame} disabled={isLoading} className="w-full bg-yellow-500 hover:bg-yellow-400 disabled:bg-yellow-700 text-black font-bold text-lg py-4 rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-all">
              {isLoading ? <Loader2 className="animate-spin" size={24} /> : <Play size={24} className="fill-current" />}
              {isLoading ? 'LOADING...' : 'PLAY NOW'}
            </button>
          </div>
        )}

        {gameState === 'playing' && currentQ && (
          <div className="flex-1 flex gap-4 animate-in fade-in duration-300">
            <LevelLadder />
            <div className="flex-1 flex flex-col relative">
              <div className="flex justify-between items-center bg-gray-900 rounded-2xl p-4 border border-gray-800 mb-4">
                <div className="flex flex-col">
                  <span className="text-xs text-gray-500 uppercase font-bold tracking-wider">Kỷ lục hiện tại</span>
                  <span className="text-2xl font-black text-yellow-500">{maxStreak}/10</span>
                </div>
                <div className="flex items-center gap-2">
                  <Timer size={20} className={timeLeft <= 10 ? 'text-red-500 animate-pulse' : 'text-gray-400'} />
                  <span className={`text-2xl font-black tabular-nums ${timeLeft <= 10 ? 'text-red-500' : 'text-white'}`}>{timeLeft}s</span>
                </div>
              </div>

              <div className="flex-1 flex flex-col justify-center mb-4">
                <h2 className="text-xl font-bold text-center leading-tight">{currentQ.q}</h2>
              </div>
              <div className="grid gap-3 mt-auto">
                {currentQ.options.map((opt, idx) => {
                  let btnStyle = "bg-gray-900 border-gray-800 text-white hover:bg-gray-800";
                  if (feedback) {
                    if (opt === currentQ.a) btnStyle = "bg-green-500 border-green-400 text-black";
                    else if (feedback.selected === opt && !feedback.isCorrect) btnStyle = "bg-red-900/50 border-red-800 text-gray-400";
                    else btnStyle = "bg-gray-900 border-gray-800 text-gray-600 opacity-50";
                  }
                  return (
                    <button key={idx} onClick={() => handleAnswer(opt)} disabled={feedback !== null} className={`w-full p-4 rounded-2xl border text-left font-medium text-lg transition-all active:scale-95 ${btnStyle}`}>
                      {opt}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Giữ nguyên phần GAME OVER như cũ */}
        {gameState === 'gameover' && ( /* Giữ nguyên UI GameOver */
          <div className="flex-1 flex flex-col animate-in slide-in-from-bottom-4 duration-300 pb-8">
            <div className="text-center mb-6">
              <h2 className="text-3xl font-black mt-4 mb-1 text-yellow-500">
                {maxLevelReached >= 10 ? 'VICTORY!' : 'GAME OVER'}
              </h2>
              <p className="text-gray-400">Score: <span className="text-white font-mono">{userFinalScore.toLocaleString()}</span></p>
            </div>

            <div className="bg-gray-900/50 rounded-2xl border border-gray-800 p-4 mb-4">
              <div className="flex items-center gap-2 mb-4 text-yellow-500">
                <Medal size={20} />
                <h3 className="font-bold uppercase tracking-wider">Global Top 10</h3>
              </div>
              {isLoading ? (<div className="flex justify-center py-6"><Loader2 className="animate-spin text-gray-500" /></div>) : (
                <div className="space-y-3">
                  {leaderboardData.map((player, idx) => (
                    <div key={idx} className="flex justify-between items-center bg-black/40 p-3 rounded-xl border border-gray-800/50">
                      <div className="flex items-center gap-3">
                        <span className={`font-black w-5 text-center ${idx === 0 ? 'text-yellow-500' : idx === 1 ? 'text-gray-300' : idx === 2 ? 'text-amber-600' : 'text-gray-600'}`}>{idx + 1}</span>
                        <span className="font-medium truncate max-w-[120px]">{player.first_name}</span>
                      </div>
                      <div className="text-right">
                        <div className="font-mono text-yellow-500 text-sm">{Number(player.best_score).toLocaleString()}</div>
                        <div className="text-[10px] text-gray-500 uppercase">Lv {player.max_level}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {!isLoading && userRank && (
              <div className="bg-yellow-500 text-black rounded-2xl p-4 mb-6 flex justify-between items-center shadow-[0_0_20px_rgba(234,179,8,0.2)]">
                <div>
                  <div className="text-sm font-bold opacity-80 uppercase tracking-wider">Your Global Rank</div>
                  <div className="text-2xl font-black">#{userRank}</div>
                </div>
                <div className="text-right">
                  <div className="font-bold">{user?.first_name}</div>
                  <div className="text-sm opacity-80 font-mono">Lv {maxLevelReached}</div>
                </div>
              </div>
            )}

            <div className="space-y-3 mt-auto">
              <button onClick={startGame} disabled={isLoading} className="w-full bg-gray-800 text-white hover:bg-gray-700 font-bold text-lg py-4 rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-transform">
                <RotateCcw size={20} /> PLAY AGAIN
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}