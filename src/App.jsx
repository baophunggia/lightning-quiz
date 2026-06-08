import React, { useState, useEffect } from 'react';
import { Zap, Timer, RotateCcw, Play, Loader2, Medal } from 'lucide-react';

const WebApp = window.Telegram?.WebApp || {
  initDataUnsafe: { user: null },
  ready: () => { },
  expand: () => { },
  HapticFeedback: { impactOccurred: () => { }, notificationOccurred: () => { } },
  showAlert: (msg) => alert(msg)
};

const MOCK_QUESTIONS = Array.from({ length: 10 }, (_, i) => ({
  id: i,
  q: `Mock Question Level ${i + 1}: What is 1+1?`,
  a: "2",
  options: ["1", "2", "3", "4"].sort(() => Math.random() - 0.5)
}));

export default function App() {
  const [gameState, setGameState] = useState('menu');
  const [currentLevel, setCurrentLevel] = useState(0);
  const [maxLevelReached, setMaxLevelReached] = useState(0);
  const [timeLeft, setTimeLeft] = useState(60);

  const [questionsList, setQuestionsList] = useState([]);
  const [feedback, setFeedback] = useState(null);
  const [user, setUser] = useState(null);

  const [logs, setLogs] = useState([]);
  const [gameStartTime, setGameStartTime] = useState(0);

  const [leaderboardData, setLeaderboardData] = useState([]);
  const [userRank, setUserRank] = useState(null);
  const [userFinalScore, setUserFinalScore] = useState(0);

  const [isLoading, setIsLoading] = useState(false);
  const [playsToday, setPlaysToday] = useState(0);
  const [currentStreak, setCurrentStreak] = useState(0);

  // Init Telegram WebApp
  useEffect(() => {
    const initApp = async () => {
      if (WebApp.initDataUnsafe?.user) {
        setUser(WebApp.initDataUnsafe.user);
        WebApp.ready();
        WebApp.expand();

        // Gửi chuỗi raw initData lên Server xử lý xác thực bảo mật
        try {
          const res = await fetch('/api/init-user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ initData: WebApp.initData })
          });

          if (res.ok) {
            const data = await res.json();
            // Đồng bộ trạng thái từ Database về giao diện người dùng
            setPlaysToday(data.plays_today);
            setCurrentStreak(data.current_streak);
            setMaxLevelReached(data.max_level || 0);
          }
        } catch (err) {
          console.error("Lỗi đồng bộ thông tin ban đầu:", err);
        }
      } else {
        // Dữ liệu giả lập khi bạn chạy thử trên trình duyệt máy tính bình thường
        setUser({ first_name: "Player Tester", username: "tester", id: 123456789 });
        setPlaysToday(0);
        setCurrentStreak(3);
      }
    };

    initApp();
  }, []);

  // Timer
  useEffect(() => {
    let timer;
    if (gameState === 'playing' && timeLeft > 0) {
      timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
    } else if (timeLeft === 0 && gameState === 'playing') {
      endGame();
    }
    return () => clearInterval(timer);
  }, [gameState, timeLeft]);

  const handlePlayClick = async () => {
    // Lượt 1: Miễn phí
    if (playsToday === 0) {
      startGame();
      return;
    }

    // Lượt 2: Xem video 15s
    if (playsToday === 1) {
      try {
        setIsLoading(true);
        // Khởi tạo Adsgram với blockId của bạn
        const AdController = window.Adsgram?.init({ blockId: "YOUR_BLOCK_ID_HERE" });

        if (AdController) {
          await AdController.show();
          // User xem xong quảng cáo thành công
          startGame();
        } else {
          // Fallback nếu script adsgram lỗi chặn (adblocker)
          alert("Không thể tải quảng cáo. Vui lòng tắt Adblock và thử lại.");
        }
      } catch (err) {
        // User skip quảng cáo giữa chừng hoặc lỗi mạng
        console.warn("Ad skipped or failed", err);
        alert("Bạn cần xem hết video để nhận thêm lượt chơi!");
      } finally {
        setIsLoading(false);
      }
      return;
    }

    // Đã hết 2 lượt
    alert("Bạn đã hết lượt chơi hôm nay. Hãy quay lại vào ngày mai để chơi tiếp và giữ Streak nhé!");
  };

  const loadNewQuestions = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/get-questions');
      if (!res.ok) throw new Error();
      const data = await res.json();
      return data.length >= 10 ? data : MOCK_QUESTIONS;
    } catch {
      return MOCK_QUESTIONS;
    } finally {
      setIsLoading(false);
    }
  };

  const startGame = async () => {
    const newQuestions = await loadNewQuestions();

    setQuestionsList(newQuestions);
    setCurrentLevel(1);
    setMaxLevelReached(0);
    setTimeLeft(60);
    setFeedback(null);
    setLogs([]);                    // Reset logs khi bắt đầu game mới
    setLeaderboardData([]);
    setUserRank(null);
    setGameState('playing');
    setGameStartTime(Date.now());
  };

  const endGame = async () => {
    setGameState('gameover');
    if (WebApp.HapticFeedback) WebApp.HapticFeedback.notificationOccurred('warning');

    const finalLevel = maxLevelReached;
    const calculatedScore = finalLevel * 10000;
    setUserFinalScore(calculatedScore);   // Hiển thị điểm ngay lập tức

    setIsLoading(true);   // Bật loading cho leaderboard

    try {
      const payload = {
        telegram_id: user?.id || 123456789,
        username: user?.username || 'unknown',
        first_name: user?.first_name || 'Player',
        logs: logs,
        startTime: gameStartTime
      };

      const res = await fetch('/api/submit-game', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const data = await res.json();
        setUserFinalScore(data.final_score || calculatedScore);
        setLeaderboardData(data.leaderboard || []);
        setUserRank(data.user_rank);
        setPlaysToday(data.plays_today);
        setCurrentStreak(data.current_streak);
      }
    } catch (err) {
      console.error("Lỗi submit:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const currentQ = questionsList[currentLevel - 1];

  const handleAnswer = async (selectedAns) => {
    if (feedback || !currentQ) return;

    const timestamp = Date.now();
    const isCorrect = selectedAns === currentQ.a;

    // Ghi log ngay lập tức
    setLogs(prev => [...prev, {
      questionId: currentQ.id,
      selectedAns,
      timestamp
    }]);

    setFeedback({ selected: selectedAns, isCorrect });

    if (isCorrect) {
      if (WebApp.HapticFeedback) WebApp.HapticFeedback.impactOccurred('light');

      setTimeout(() => {
        const nextLevel = currentLevel + 1;
        setCurrentLevel(nextLevel);
        if (nextLevel > maxLevelReached) setMaxLevelReached(nextLevel);

        if (nextLevel > 10) {
          endGame();
        } else {
          setFeedback(null);
        }
      }, 600);
    } else {
      if (WebApp.HapticFeedback) WebApp.HapticFeedback.notificationOccurred('error');

      setTimeout(async () => {
        setFeedback(null);

        // Reset về level 1 + câu hỏi mới
        const newQuestions = await loadNewQuestions();
        setQuestionsList(newQuestions);
        setCurrentLevel(1);
        // maxLevelReached giữ nguyên (để hiển thị thành tích cao nhất)
      }, 900);
    }
  };

  const LevelLadder = () => (
    <div className="w-16 bg-gray-900/50 rounded-xl p-2 flex flex-col-reverse justify-between border border-gray-800">
      {[...Array(10)].map((_, i) => {
        const level = i + 1;
        const isCurrent = level === currentLevel;
        const isPassed = level < currentLevel;
        return (
          <div
            key={level}
            className={`flex items-center justify-center h-8 text-sm font-bold rounded-lg transition-all ${isCurrent ? 'bg-yellow-500 text-black scale-110 shadow-[0_0_10px_rgba(234,179,8,0.5)]'
              : isPassed ? 'bg-green-500/20 text-green-400'
                : 'text-gray-500'
              }`}
          >
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
          <div className="bg-yellow-500 p-1.5 rounded-lg">
            <Zap size={20} className="text-black" />
          </div>
          <span className="font-bold text-lg tracking-tight">Lightning Trivia</span>
        </div>
      </header>

      <main className="flex-1 flex flex-col p-4 max-w-md mx-auto w-full">
        {/* MENU */}
        {gameState === 'menu' && (
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <h1 className="text-4xl font-extrabold mt-6 mb-2 uppercase bg-gradient-to-br from-yellow-400 to-yellow-600 bg-clip-text text-transparent">
              Reach Level 10
            </h1>
            <p className="text-gray-400 mb-8 px-4">Answer 10 questions correctly in a row.<br />Fast answers get higher ranks!</p>
            <button
              onClick={handlePlayClick}
              disabled={isLoading || playsToday >= 2}
              className="w-full bg-yellow-500 hover:bg-yellow-400 disabled:bg-gray-700 disabled:text-gray-400 text-black font-bold text-lg py-4 rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-all"
            >
              {isLoading ? <Loader2 className="animate-spin" size={24} /> : <Play size={24} />}
              {isLoading ? 'LOADING...'
                : playsToday === 0 ? 'PLAY NOW (FREE)'
                  : playsToday === 1 ? 'WATCH AD TO PLAY'
                    : 'COME BACK TOMORROW'}
            </button>
          </div>
        )}

        {/* PLAYING */}
        {gameState === 'playing' && currentQ && (
          <div className="flex-1 flex gap-4">
            <LevelLadder />
            <div className="flex-1 flex flex-col">
              <div className="flex justify-between items-center bg-gray-900 rounded-2xl p-4 border border-gray-800 mb-4">
                <div>
                  <span className="text-xs text-gray-500 uppercase font-bold tracking-wider">LEVEL</span>
                  <span className="text-2xl font-black text-yellow-500 block">{currentLevel}/10</span>
                </div>
                <div className="flex items-center gap-2">
                  <Timer size={20} className={timeLeft <= 10 ? 'text-red-500 animate-pulse' : ''} />
                  <span className={`text-2xl font-black ${timeLeft <= 10 ? 'text-red-500' : ''}`}>{timeLeft}s</span>
                </div>
              </div>

              <div className="flex-1 flex flex-col justify-center mb-4">
                <h2 className="text-xl font-bold text-center leading-tight">{currentQ.q}</h2>
              </div>

              <div className="grid gap-3 mt-auto">
                {currentQ.options.map((opt, idx) => {
                  let btnStyle = "bg-gray-900 border-gray-800 text-white hover:bg-gray-800";
                  if (feedback) {
                    if (opt === currentQ.a) btnStyle = "bg-green-500 border-green-400 text-black font-bold";
                    else if (feedback.selected === opt) btnStyle = "bg-red-900/70 border-red-800 text-gray-400";
                    else btnStyle = "opacity-50";
                  }
                  return (
                    <button
                      key={idx}
                      onClick={() => handleAnswer(opt)}
                      disabled={!!feedback}
                      className={`w-full p-4 rounded-2xl border text-left font-medium text-lg transition-all active:scale-95 ${btnStyle}`}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {gameState === 'gameover' && (
          <div className="flex-1 flex flex-col pb-8">
            {/* Header kết quả */}
            <div className="text-center mt-8 mb-8">
              <h2 className="text-4xl font-black text-yellow-500">
                {maxLevelReached >= 10 ? 'VICTORY!' : 'GAME OVER'}
              </h2>

              <p className="text-3xl mt-3 font-mono text-white">
                {userFinalScore.toLocaleString()}
              </p>
              <p className="text-sm text-gray-500">điểm trận này</p>
            </div>

            {/* Leaderboard */}
            <div className="bg-gray-900/50 rounded-3xl border border-gray-800 p-5 mb-6 flex-1 flex flex-col">
              <div className="flex items-center gap-3 mb-5 text-yellow-500">
                <Medal size={26} />
                <h3 className="font-bold uppercase tracking-wider text-lg">Global Top 10</h3>
              </div>

              {isLoading ? (
                <div className="flex-1 flex flex-col items-center justify-center py-12">
                  <Loader2 className="animate-spin text-yellow-500 mb-4" size={48} />
                  <p className="text-gray-400">Đang cập nhật bảng xếp hạng...</p>
                </div>
              ) : leaderboardData.length > 0 ? (
                <div className="space-y-3 flex-1 overflow-auto pr-2">
                  {leaderboardData.map((player, idx) => {
                    const isCurrentUser = player.first_name === user?.first_name;
                    return (
                      <div
                        key={idx}
                        className={`flex justify-between items-center bg-black/60 p-4 rounded-2xl border transition-all ${isCurrentUser
                          ? 'border-yellow-500 bg-yellow-500/10 ring-1 ring-yellow-500'
                          : 'border-gray-800'
                          }`}
                      >
                        <div className="flex items-center gap-4">
                          <span className={`font-black text-xl w-8 text-center ${idx === 0 ? 'text-yellow-400' : ''}`}>
                            {idx + 1}
                          </span>
                          <span className={`font-medium ${isCurrentUser ? 'text-yellow-400' : ''}`}>
                            {player.first_name}
                          </span>
                        </div>
                        <div className="text-right">
                          <div className="font-mono text-yellow-400 text-lg font-semibold">
                            {Number(player.best_score).toLocaleString()}
                          </div>
                          <div className="text-xs text-gray-500">Level {player.max_level}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center text-gray-500 py-10">
                  Không có dữ liệu
                </div>
              )}
            </div>

            {!isLoading && userRank && (
              <div className="bg-gradient-to-r from-yellow-500 to-amber-500 text-black rounded-3xl p-6 mb-6 shadow-xl">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="uppercase text-xs font-bold tracking-widest opacity-75">XẾP HẠNG CỦA BẠN</div>
                    <div className="text-5xl font-black">#{userRank}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-xl">{user?.first_name}</div>
                    <div className="text-sm opacity-80">Level {maxLevelReached} • Best: {userFinalScore.toLocaleString()}</div>
                  </div>
                </div>
              </div>
            )}

            <button
              onClick={handlePlayClick}
              disabled={isLoading}
              className="w-full bg-white text-black font-bold py-5 rounded-3xl flex items-center justify-center gap-3 text-lg active:scale-95 transition-all disabled:opacity-70 mt-auto"
            >
              <RotateCcw size={22} /> CHƠI LẠI
            </button>
          </div>
        )}
      </main>
    </div>
  );
}