import React, { useState, useEffect, useCallback } from 'react';
import { Zap, Timer, Trophy, RotateCcw, Play, Star, Video, Loader2, Medal } from 'lucide-react';

const WebApp = window.Telegram?.WebApp || {
  initDataUnsafe: { user: null },
  ready: () => {},
  expand: () => {},
  HapticFeedback: { impactOccurred: () => {}, notificationOccurred: () => {} },
  showAlert: (msg) => alert(msg)
};

const MOCK_QUESTION = { id: 0, q: "Which planet is known as the Red Planet?", a: "Mars", options: ["Venus", "Mars", "Jupiter", "Saturn"] };

export default function App() {
  const [gameState, setGameState] = useState('menu'); 
  const [currentLevel, setCurrentLevel] = useState(0); 
  const [maxLevelReached, setMaxLevelReached] = useState(0);
  const [timeLeft, setTimeLeft] = useState(60);
  
  const [currentQ, setCurrentQ] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [user, setUser] = useState(null);
  const [userStars, setUserStars] = useState(0);
  
  // States mới cho Leaderboard & Timing
  const [gameStartTime, setGameStartTime] = useState(0);
  const [leaderboardData, setLeaderboardData] = useState([]);
  const [userRank, setUserRank] = useState(null);
  const [userFinalScore, setUserFinalScore] = useState(0);

  const [isLoading, setIsLoading] = useState(false);
  const [isWatchingAd, setIsWatchingAd] = useState(false);

  useEffect(() => {
    if (WebApp.initDataUnsafe?.user) {
      setUser(WebApp.initDataUnsafe.user);
      WebApp.ready(); WebApp.expand();
    } else {
      setUser({ first_name: "Player", username: "tester", id: 123456789 });
    }
  }, []);

  useEffect(() => {
    let timer;
    if (gameState === 'playing' && !isLoading && timeLeft > 0) {
      timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
    } else if (timeLeft === 0 && gameState === 'playing') {
      endGame(currentLevel);
    }
    return () => clearInterval(timer);
  }, [gameState, timeLeft, isLoading, currentLevel]);

  const fetchQuestion = async (level) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/get-question?level=${level}`);
      if (!res.ok) throw new Error("API error");
      const data = await res.json();
      setCurrentQ(data);
    } catch (err) {
      const shuffledOptions = [...MOCK_QUESTION.options].sort(() => Math.random() - 0.5);
      setCurrentQ({ ...MOCK_QUESTION, options: shuffledOptions });
    } finally {
      setIsLoading(false);
    }
  };

  const saveScore = async (finalLevel) => {
    setIsLoading(true);
    try {
      // 1. Tính toán điểm số chính xác tới Mili-giây
      const timeTakenMs = Date.now() - gameStartTime;
      const timeRemainingMs = Math.max(0, 60000 - timeTakenMs); 
      // Công thức: Level * 10,000 + Milliseconds dư
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
      
      if(res.ok) {
        const data = await res.json();
        setLeaderboardData(data.leaderboard || []);
        setUserRank(data.user_rank);
      }
    } catch (err) {
      console.error("Lỗi lưu điểm:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const startGame = async () => {
    setCurrentLevel(1);
    setMaxLevelReached(0);
    setTimeLeft(60);
    setFeedback(null);
    setLeaderboardData([]);
    setUserRank(null);
    setGameState('playing');
    setGameStartTime(Date.now()); // Bắt đầu bấm đồng hồ Mili-giây
    await fetchQuestion(1);
  };

  const endGame = async (finalLevel) => {
    setGameState('gameover');
    if (WebApp.HapticFeedback) WebApp.HapticFeedback.notificationOccurred('warning');
    await saveScore(finalLevel);
  };

  const handleAnswer = async (selectedAns) => {
    if (feedback !== null || isLoading) return; 

    const isCorrect = selectedAns === currentQ.a;
    setFeedback({ selected: selectedAns, isCorrect }); 
    
    if (isCorrect) {
      if (WebApp.HapticFeedback) WebApp.HapticFeedback.impactOccurred('light');
      setTimeout(async () => {
        const nextLevel = currentLevel + 1;
        setCurrentLevel(nextLevel);
        if (nextLevel > maxLevelReached) setMaxLevelReached(nextLevel);
        
        if (nextLevel > 10) {
          endGame(10); 
        } else {
          setFeedback(null);
          await fetchQuestion(nextLevel); 
        }
      }, 800);
    } else {
      if (WebApp.HapticFeedback) WebApp.HapticFeedback.notificationOccurred('error');
      setTimeout(() => {
        setFeedback(null);
        endGame(currentLevel - 1); 
      }, 1200);
    }
  };

  const handleWatchAd = async () => {
    setIsWatchingAd(true);
    try {
      const AdController = window.Adsgram ? window.Adsgram.init({ blockId: "123456" }) : { 
        show: () => new Promise(resolve => setTimeout(() => resolve({ done: true }), 2000)) 
      };
      const result = await AdController.show();
      if (result) {
        setUserStars(prev => prev + 50);
        if (WebApp.HapticFeedback) WebApp.HapticFeedback.notificationOccurred('success');
        WebApp.showAlert("Awesome! You earned 50 Stars 🌟");
      }
    } catch (error) {
      WebApp.showAlert("Ad skipped. No stars awarded.");
    } finally {
      setIsWatchingAd(false);
    }
  };

  const LevelLadder = () => (
    <div className="w-16 bg-gray-900/50 rounded-xl p-2 flex flex-col-reverse justify-between border border-gray-800">
      {[...Array(10)].map((_, i) => {
        const level = i + 1;
        const isCurrent = level === currentLevel;
        const isPassed = level < currentLevel;
        return (
          <div key={level} className={`flex items-center justify-center h-8 text-sm font-bold rounded-lg transition-all ${isCurrent ? 'bg-yellow-500 text-black scale-110 shadow-[0_0_10px_rgba(234,179,8,0.5)]' : isPassed ? 'bg-green-500/20 text-green-400' : 'text-gray-500'}`}>
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
        <div className="flex items-center gap-2 bg-gray-900 px-3 py-1.5 rounded-full border border-gray-800">
          <Star size={16} className="text-yellow-500" />
          <span className="text-sm font-medium font-mono">{userStars}</span>
        </div>
      </header>

      <main className="flex-1 flex flex-col p-4 max-w-md mx-auto w-full relative">
        {gameState === 'menu' && (
          <div className="flex-1 flex flex-col items-center justify-center text-center animate-in fade-in zoom-in duration-300">
            <div className="w-24 h-24 bg-yellow-500 rounded-3xl flex items-center justify-center mb-6 shadow-[0_0_40px_rgba(234,179,8,0.3)] rotate-3">
              <Zap size={48} className="text-black fill-current" />
            </div>
            <h1 className="text-4xl font-extrabold mb-2 uppercase tracking-wider text-transparent bg-clip-text bg-gradient-to-br from-yellow-400 to-yellow-600">
              Reach Level 10
            </h1>
            <p className="text-gray-400 mb-8 px-4">Answer 10 questions correctly in a row. Fast answers get higher ranks!</p>
            <button onClick={startGame} className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-bold text-lg py-4 rounded-2xl flex items-center justify-center gap-2 transition-transform active:scale-95">
              <Play size={24} className="fill-current" /> PLAY NOW
            </button>
          </div>
        )}

        {gameState === 'playing' && (
          <div className="flex-1 flex gap-4 animate-in fade-in duration-300">
            <LevelLadder />
            <div className="flex-1 flex flex-col relative">
              <div className="flex justify-between items-center bg-gray-900 rounded-2xl p-4 border border-gray-800 mb-4">
                <div className="flex flex-col">
                  <span className="text-xs text-gray-500 uppercase font-bold tracking-wider">Level</span>
                  <span className="text-2xl font-black text-yellow-500">{currentLevel}/10</span>
                </div>
                <div className="flex items-center gap-2">
                  <Timer size={20} className={timeLeft <= 10 ? 'text-red-500 animate-pulse' : 'text-gray-400'} />
                  <span className={`text-2xl font-black tabular-nums ${timeLeft <= 10 ? 'text-red-500' : 'text-white'}`}>{timeLeft}s</span>
                </div>
              </div>

              {isLoading ? (
                <div className="flex-1 flex flex-col items-center justify-center">
                  <Loader2 className="w-12 h-12 text-yellow-500 animate-spin mb-4" />
                </div>
              ) : currentQ ? (
                <>
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
                        <button key={idx} onClick={() => handleAnswer(opt)} disabled={feedback !== null || isLoading} className={`w-full p-4 rounded-2xl border text-left font-medium text-lg transition-all active:scale-95 ${btnStyle}`}>
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                </>
              ) : null}
            </div>
          </div>
        )}

        {gameState === 'gameover' && (
          <div className="flex-1 flex flex-col animate-in slide-in-from-bottom-4 duration-300 pb-8">
            <div className="text-center mb-6">
              <h2 className="text-3xl font-black mt-4 mb-1 text-yellow-500">
                {maxLevelReached >= 10 ? 'VICTORY!' : 'GAME OVER'}
              </h2>
              <p className="text-gray-400">Score: <span className="text-white font-mono">{userFinalScore.toLocaleString()}</span></p>
            </div>

            {/* BẢNG XẾP HẠNG TOP 10 */}
            <div className="bg-gray-900/50 rounded-2xl border border-gray-800 p-4 mb-4">
              <div className="flex items-center gap-2 mb-4 text-yellow-500">
                <Medal size={20} />
                <h3 className="font-bold uppercase tracking-wider">Global Top 10</h3>
              </div>
              
              {isLoading ? (
                 <div className="flex justify-center py-6"><Loader2 className="animate-spin text-gray-500"/></div>
              ) : (
                <div className="space-y-3">
                  {leaderboardData.map((player, idx) => (
                    <div key={idx} className="flex justify-between items-center bg-black/40 p-3 rounded-xl border border-gray-800/50">
                      <div className="flex items-center gap-3">
                        <span className={`font-black w-5 text-center ${idx === 0 ? 'text-yellow-500' : idx === 1 ? 'text-gray-300' : idx === 2 ? 'text-amber-600' : 'text-gray-600'}`}>
                          {idx + 1}
                        </span>
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

            {/* VỊ TRÍ CỦA NGƯỜI CHƠI (PINNED RANK) */}
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
              <button onClick={handleWatchAd} disabled={isWatchingAd || isLoading} className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white font-bold text-lg py-4 rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-transform">
                {isWatchingAd ? <Loader2 className="animate-spin" size={20}/> : <Video size={20} />}
                {isWatchingAd ? 'Loading Ad...' : 'Earn 50 Stars'}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}