import React, { useState, useEffect, useCallback } from 'react';
import { Zap, Timer, RotateCcw, Play, Star, Loader2, Medal } from 'lucide-react';

const WebApp = window.Telegram?.WebApp || {
  initDataUnsafe: { user: { first_name: "Player", username: "tester", id: 123456789 } },
  ready: () => { }, expand: () => { },
  HapticFeedback: { impactOccurred: () => { }, notificationOccurred: () => { } },
  showAlert: (msg) => alert(msg)
};

export default function App() {
  const [gameState, setGameState] = useState('menu');
  const [timeLeft, setTimeLeft] = useState(60);
  const [questionsList, setQuestionsList] = useState([]);
  const [qIndex, setQIndex] = useState(0);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [maxStreak, setMaxStreak] = useState(0);
  const [feedback, setFeedback] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const [leaderboardData, setLeaderboardData] = useState([]);
  const [userRank, setUserRank] = useState(null);
  const [userFinalScore, setUserFinalScore] = useState(0);

  const actionLogs = useRef([]);
  const gameStartTime = useRef(0);
  const user = WebApp.initDataUnsafe?.user || { first_name: "Player", id: 123456789 };

  // Sync Logic
  useEffect(() => {
    let timer;
    if (gameState === 'playing' && timeLeft > 0 && currentStreak < 10) {
      timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
    } else if ((timeLeft === 0 || currentStreak >= 10) && gameState === 'playing') {
      endGame();
    }
    return () => clearInterval(timer);
  }, [gameState, timeLeft, currentStreak]);

  const startGame = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/get-questions');
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        setQuestionsList(data);
        setQIndex(0);
        setCurrentStreak(0);
        setMaxStreak(0);
        setTimeLeft(60);
        actionLogs.current = [];
        gameStartTime.current = Date.now();
        setGameState('playing');
      }
    } catch (err) {
      WebApp.showAlert("Không thể tải câu hỏi!");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnswer = (selectedAns) => {
    if (feedback !== null || !questionsList[qIndex]) return;
    const isCorrect = selectedAns === questionsList[qIndex].a;
    setFeedback({ selected: selectedAns, isCorrect });

    actionLogs.current.push({ questionId: questionsList[qIndex].id, selectedAns, timestamp: Date.now() });

    if (isCorrect) {
      setCurrentStreak(prev => {
        const next = prev + 1;
        if (next > maxStreak) setMaxStreak(next);
        return next;
      });
    } else {
      setCurrentStreak(0);
    }

    setTimeout(() => {
      setFeedback(null);
      if (qIndex + 1 < questionsList.length && currentStreak < 9) {
        setQIndex(prev => prev + 1);
      } else {
        endGame();
      }
    }, 500);
  };

  const endGame = async () => {
    setGameState('gameover');
    setIsLoading(true);
    try {
      const res = await fetch('/api/submit-game', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telegram_id: user.id, username: user.username, first_name: user.first_name,
          logs: actionLogs.current, startTime: gameStartTime.current
        })
      });
      const data = await res.json();
      setLeaderboardData(data.leaderboard || []);
      setUserRank(data.user_rank || '-');
      setUserFinalScore(data.final_score || 0);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const currentQ = questionsList[qIndex];

  return (
    <div className="min-h-screen bg-black text-white p-4 font-sans">
      {gameState === 'menu' && (
        <div className="flex flex-col items-center justify-center min-h-screen">
          <Zap size={64} className="text-yellow-500 mb-6" />
          <h1 className="text-3xl font-black mb-8">LIGHTNING TRIVIA</h1>
          <button onClick={startGame} disabled={isLoading} className="w-full bg-yellow-500 text-black py-4 rounded-2xl font-bold text-lg">
            {isLoading ? <Loader2 className="animate-spin mx-auto" /> : "PLAY NOW"}
          </button>
        </div>
      )}

      {gameState === 'playing' && currentQ && (
        <div className="flex flex-col h-screen">
          <div className="flex justify-between p-4 bg-gray-900 rounded-xl mb-4">
            <span className="font-bold text-yellow-500">Lv {currentStreak + 1}/10</span>
            <span className="font-mono text-xl">{timeLeft}s</span>
          </div>
          <h2 className="text-xl font-bold text-center my-8">{currentQ.q}</h2>
          <div className="grid gap-3 mt-auto mb-8">
            {currentQ.options.map((opt, i) => (
              <button key={i} onClick={() => handleAnswer(opt)}
                className={`p-4 rounded-xl border ${feedback?.selected === opt ? (feedback.isCorrect ? 'bg-green-500' : 'bg-red-500') : 'bg-gray-800'}`}>
                {opt}
              </button>
            ))}
          </div>
        </div>
      )}

      {gameState === 'gameover' && (
        <div className="flex flex-col items-center justify-center min-h-screen">
          <Trophy size={48} className="text-yellow-500 mb-4" />
          <h2 className="text-2xl font-bold mb-4">SCORE: {userFinalScore.toLocaleString()}</h2>

          <div className="w-full bg-gray-900 p-4 rounded-xl mb-6">
            <h3 className="text-yellow-500 font-bold mb-3 flex items-center gap-2"><Medal size={16} /> TOP 10</h3>
            {leaderboardData.map((p, i) => (
              <div key={i} className="flex justify-between py-2 border-b border-gray-800">
                <span>{p.first_name}</span>
                <span className="font-mono text-yellow-500">{p.best_score.toLocaleString()}</span>
              </div>
            ))}
          </div>

          <button onClick={() => setGameState('menu')} className="w-full bg-gray-800 py-4 rounded-xl font-bold">PLAY AGAIN</button>
        </div>
      )}
    </div>
  );
}