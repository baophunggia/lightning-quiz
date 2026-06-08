import React, { useState, useEffect } from 'react';
import { Zap, Timer, Trophy, RotateCcw, Play, Loader2, Medal } from 'lucide-react';

const WebApp = window.Telegram?.WebApp || {
  initDataUnsafe: { user: null },
  ready: () => { },
  expand: () => { },
  HapticFeedback: { impactOccurred: () => { }, notificationOccurred: () => { } },
  showAlert: (msg) => alert(msg)
};

// Mock Questions
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

  const [gameStartTime, setGameStartTime] = useState(0);
  const [leaderboardData, setLeaderboardData] = useState([]);
  const [userRank, setUserRank] = useState(null);
  const [userFinalScore, setUserFinalScore] = useState(0);

  const [isLoading, setIsLoading] = useState(false);

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
      timer = setInterval(() => {
        setTimeLeft(prev => prev - 1);
      }, 1000);
    } else if (timeLeft === 0 && gameState === 'playing') {
      endGame(currentLevel);
    }
    return () => clearInterval(timer);
  }, [gameState, timeLeft, currentLevel]);

  const saveScore = async (finalLevel) => {
    setIsLoading(true);
    try {
      const timeTakenMs = Date.now() - gameStartTime;
      const timeRemainingMs = Math.max(0, 60000 - timeTakenMs);
      const calculatedScore = (finalLevel * 10000) + timeRemainingMs;

      setUserFinalScore(calculatedScore);

      const payload = {
        telegram_id: user?.id || 123456789,
        username: user?.username || 'unknown',
        first_name: user?.first_name || 'Player',
        max_level: finalLevel,
        best_score: calculatedScore
      };

      const res = await fetch('/api/save-score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const data = await res.json();
        setLeaderboardData(data.leaderboard || []);
        setUserRank(data.user_rank);
      } else {
        console.error("Save score failed");
      }
    } catch (err) {
      console.error("Lỗi lưu điểm:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadNewQuestions = async () => {
    try {
      const res = await fetch('/api/get-questions');
      if (res.ok) {
        const data = await res.json();
        return data.length >= 10 ? data : MOCK_QUESTIONS;
      }
    } catch (err) {
      console.warn("Dùng mock questions");
    }
    return MOCK_QUESTIONS;
  };

  const startGame = async () => {
    setIsLoading(true);
    const newQuestions = await loadNewQuestions();

    setQuestionsList(newQuestions);
    setCurrentLevel(1);
    setMaxLevelReached(0);
    setTimeLeft(60);
    setFeedback(null);
    setLeaderboardData([]);
    setUserRank(null);
    setGameState('playing');
    setGameStartTime(Date.now());
    setIsLoading(false);
  };

  const endGame = async (finalLevel) => {
    setGameState('gameover');
    if (WebApp.HapticFeedback) WebApp.HapticFeedback.notificationOccurred('warning');
    await saveScore(finalLevel);
  };

  const currentQ = questionsList[currentLevel - 1];

  const handleAnswer = async (selectedAns) => {
    if (feedback || !currentQ) return;

    const isCorrect = selectedAns === currentQ.a;
    setFeedback({ selected: selectedAns, isCorrect });

    if (isCorrect) {
      if (WebApp.HapticFeedback) WebApp.HapticFeedback.impactOccurred('light');

      setTimeout(() => {
        const nextLevel = currentLevel + 1;
        setCurrentLevel(nextLevel);
        if (nextLevel > maxLevelReached) setMaxLevelReached(nextLevel);

        if (nextLevel > 10) {
          endGame(10);
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
        setMaxLevelReached(Math.max(maxLevelReached, 1)); // Giữ max level đã đạt
      }, 800);
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
            className={`flex items-center justify-center h-8 text-sm font-bold rounded-lg transition-all ${isCurrent
                ? 'bg-yellow-500 text-black scale-110 shadow-[0_0_10px_rgba(234,179,8,0.5)]'
                : isPassed
                  ? 'bg-green-500/20 text-green-400'
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
            <Zap size={20} className="text-black fill-current" />
          </div>
          <span className="font-bold text-lg tracking-tight">Lightning Trivia</span>
        </div>
      </header>

      <main className="flex-1 flex flex-col p-4 max-w-md mx-auto w-full relative">
        {/* Menu */}
        {gameState === 'menu' && (
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <h1 className="text-4xl font-extrabold mt-6 mb-2 uppercase text-transparent bg-clip-text bg-gradient-to-br from-yellow-400 to-yellow-600">
              Reach Level 10
            </h1>
            <p className="text-gray-400 mb-8 px-4">Answer 10 questions correctly in a row.<br />Fast answers = Higher ranks!</p>
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

        {/* Playing */}
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
                    if (opt === currentQ.a) btnStyle = "bg-green-500 border-green-400 text-black";
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

        {/* Game Over */}
        {gameState === 'gameover' && (
          <div className="flex-1 flex flex-col pb-8">
            <div className="text-center mb-8 mt-6">
              <h2 className="text-4xl font-black text-yellow-500 mb-2">
                {maxLevelReached >= 10 ? 'VICTORY!' : 'GAME OVER'}
              </h2>
              <p className="text-2xl text-gray-400">
                Score: <span className="font-mono text-white">{userFinalScore.toLocaleString()}</span>
              </p>
            </div>

            {/* Leaderboard giữ nguyên như cũ */}
            <div className="bg-gray-900/50 rounded-2xl border border-gray-800 p-4 mb-6 flex-1 overflow-auto">
              {/* ... giữ nguyên phần leaderboard ... */}
              {isLoading ? (
                <div className="flex justify-center py-12"><Loader2 className="animate-spin" /></div>
              ) : (
                <div className="space-y-3">
                  {leaderboardData.map((player, idx) => (
                    <div key={idx} className="flex justify-between items-center bg-black/40 p-3 rounded-xl">
                      <div className="flex items-center gap-3">
                        <span className="font-black w-6">{idx + 1}</span>
                        <span>{player.first_name}</span>
                      </div>
                      <div className="text-right">
                        <div className="font-mono text-yellow-500">{Number(player.best_score).toLocaleString()}</div>
                        <div className="text-xs text-gray-500">Lv {player.max_level}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={startGame}
              disabled={isLoading}
              className="w-full bg-gray-800 hover:bg-gray-700 font-bold py-4 rounded-2xl flex items-center justify-center gap-2 mt-auto"
            >
              <RotateCcw size={20} /> PLAY AGAIN
            </button>
          </div>
        )}
      </main>
    </div>
  );
}