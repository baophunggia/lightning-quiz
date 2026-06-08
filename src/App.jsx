import React, { useState, useEffect } from 'react';
import { Zap, Timer, RotateCcw, Play, Loader2, Medal } from 'lucide-react';

const WebApp = window.Telegram?.WebApp || {
  initDataUnsafe: { user: null },
  ready: () => {}, 
  expand: () => {},
  HapticFeedback: { impactOccurred: () => {}, notificationOccurred: () => {} },
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

  const [logs, setLogs] = useState([]);           // ← Mới: lưu lịch sử trả lời
  const [gameStartTime, setGameStartTime] = useState(0);

  const [leaderboardData, setLeaderboardData] = useState([]);
  const [userRank, setUserRank] = useState(null);
  const [userFinalScore, setUserFinalScore] = useState(0);

  const [isLoading, setIsLoading] = useState(false);

  // Init Telegram WebApp
  useEffect(() => {
    if (WebApp.initDataUnsafe?.user) {
      setUser(WebApp.initDataUnsafe.user);
      WebApp.ready();
      WebApp.expand();
    } else {
      setUser({ first_name: "Player", username: "tester", id: 123456789 });
    }
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

    try {
      const payload = {
        telegram_id: user?.id || 123456789,
        username: user?.username || 'unknown',
        first_name: user?.first_name || 'Player',
        logs: logs,
        startTime: gameStartTime
      };

      const res = await fetch('/api/save-score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const data = await res.json();
        setUserFinalScore(data.final_score || finalLevel * 10000);
        setLeaderboardData(data.leaderboard || []);
        setUserRank(data.user_rank);
      }
    } catch (err) {
      console.error("Lỗi submit điểm:", err);
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
            className={`flex items-center justify-center h-8 text-sm font-bold rounded-lg transition-all ${
              isCurrent ? 'bg-yellow-500 text-black scale-110 shadow-[0_0_10px_rgba(234,179,8,0.5)]' 
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
              onClick={startGame}
              disabled={isLoading}
              className="w-full bg-yellow-500 hover:bg-yellow-400 disabled:bg-yellow-700 text-black font-bold text-lg py-4 rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-all"
            >
              {isLoading ? <Loader2 className="animate-spin" size={24} /> : <Play size={24} />}
              {isLoading ? 'LOADING...' : 'PLAY NOW'}
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

        {/* GAME OVER */}
        {gameState === 'gameover' && (
          <div className="flex-1 flex flex-col pb-8">
            <div className="text-center mt-8 mb-8">
              <h2 className="text-4xl font-black text-yellow-500">
                {maxLevelReached >= 10 ? 'VICTORY!' : 'GAME OVER'}
              </h2>
              <p className="text-2xl mt-2 text-gray-400">
                Score: <span className="font-mono text-white">{userFinalScore.toLocaleString()}</span>
              </p>
            </div>

            <div className="bg-gray-900/50 rounded-2xl border border-gray-800 p-4 mb-6 flex-1 overflow-auto">
              <div className="flex items-center gap-2 mb-4 text-yellow-500">
                <Medal size={22} />
                <h3 className="font-bold uppercase tracking-wider">Global Top 10</h3>
              </div>

              {leaderboardData.length > 0 ? (
                <div className="space-y-3">
                  {leaderboardData.map((player, idx) => (
                    <div key={idx} className="flex justify-between items-center bg-black/40 p-3 rounded-xl border border-gray-800/50">
                      <div className="flex items-center gap-3">
                        <span className="font-black w-6 text-center">{idx + 1}</span>
                        <span className="truncate">{player.first_name}</span>
                      </div>
                      <div className="text-right">
                        <div className="font-mono text-yellow-500">{Number(player.best_score).toLocaleString()}</div>
                        <div className="text-xs text-gray-500">Lv {player.max_level}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-gray-500 py-8">No leaderboard data</p>
              )}
            </div>

            <button
              onClick={startGame}
              className="w-full bg-gray-800 hover:bg-gray-700 font-bold py-4 rounded-2xl flex items-center justify-center gap-2 mt-auto active:scale-95"
            >
              <RotateCcw size={20} /> PLAY AGAIN
            </button>
          </div>
        )}
      </main>
    </div>
  );
}