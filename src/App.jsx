import React, { useState, useEffect, useCallback } from 'react';
import { Zap, Timer, Trophy, RotateCcw, Play, CheckCircle2, XCircle, Star } from 'lucide-react';

const WebApp = window.Telegram?.WebApp || {
  initDataUnsafe: { user: null },
  ready: () => {},
  expand: () => {},
  HapticFeedback: {
    impactOccurred: () => {},
    notificationOccurred: () => {}
  }
};

// Dữ liệu câu hỏi đa quốc gia (Tiếng Anh)
const QUESTIONS = [
  { q: "Which planet is known as the Red Planet?", a: "Mars", options: ["Venus", "Mars", "Jupiter", "Saturn"] },
  { q: "What is the capital of Japan?", a: "Tokyo", options: ["Seoul", "Beijing", "Tokyo", "Bangkok"] },
  { q: "Who painted the Mona Lisa?", a: "Leonardo da Vinci", options: ["Van Gogh", "Picasso", "Da Vinci", "Rembrandt"] },
  { q: "What is the chemical symbol for Gold?", a: "Au", options: ["Ag", "Au", "Fe", "Cu"] },
  { q: "Which ocean is the largest?", a: "Pacific", options: ["Atlantic", "Indian", "Arctic", "Pacific"] },
  { q: "What is the hardest natural substance?", a: "Diamond", options: ["Gold", "Iron", "Diamond", "Platinum"] },
  { q: "How many continents are there?", a: "7", options: ["5", "6", "7", "8"] },
  { q: "Which animal is the tallest in the world?", a: "Giraffe", options: ["Elephant", "Giraffe", "Ostrich", "Kangaroo"] },
  { q: "What is the fastest land animal?", a: "Cheetah", options: ["Lion", "Cheetah", "Horse", "Leopard"] },
  { q: "In computing, what does RAM stand for?", a: "Random Access Memory", options: ["Read Access Memory", "Random Access Memory", "Run All Memory", "Read All Memory"] },
  { q: "What is the largest country by area?", a: "Russia", options: ["Canada", "China", "USA", "Russia"] },
  { q: "Who wrote 'Hamlet'?", a: "William Shakespeare", options: ["Charles Dickens", "William Shakespeare", "Mark Twain", "Jane Austen"] }
];

export default function App() {
  const [gameState, setGameState] = useState('menu'); // menu, playing, gameover
  const [currentLevel, setCurrentLevel] = useState(0); // Từ 0 đến 10
  const [maxLevelReached, setMaxLevelReached] = useState(0);
  const [timeLeft, setTimeLeft] = useState(60);
  const [currentQ, setCurrentQ] = useState(null);
  const [feedback, setFeedback] = useState(null); // 'correct', 'wrong', null
  const [user, setUser] = useState(null);

  // Khởi tạo Telegram SDK
  useEffect(() => {
    if (WebApp.initDataUnsafe?.user) {
      setUser(WebApp.initDataUnsafe.user);
      WebApp.ready();
      WebApp.expand();
    } else {
      // Mock user for local testing
      setUser({ first_name: "Player", username: "tester" });
    }
  }, []);

  // Timer logic
  useEffect(() => {
    let timer;
    if (gameState === 'playing' && timeLeft > 0) {
      timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
    } else if (timeLeft === 0 && gameState === 'playing') {
      endGame();
    }
    return () => clearInterval(timer);
  }, [gameState, timeLeft]);

  const getRandomQuestion = () => {
    const randomIndex = Math.floor(Math.random() * QUESTIONS.length);
    const q = QUESTIONS[randomIndex];
    // Xáo trộn đáp án
    const shuffledOptions = [...q.options].sort(() => Math.random() - 0.5);
    return { ...q, options: shuffledOptions };
  };

  const startGame = () => {
    setCurrentLevel(0);
    setMaxLevelReached(0);
    setTimeLeft(60);
    setCurrentQ(getRandomQuestion());
    setGameState('playing');
    setFeedback(null);
  };

  const endGame = useCallback(() => {
    setGameState('gameover');
    if (WebApp.HapticFeedback) {
      WebApp.HapticFeedback.notificationOccurred('warning');
    }
  }, []);

  const handleAnswer = (selectedAns) => {
    if (feedback !== null) return; // Đang hiện kết quả thì không cho bấm

    const isCorrect = selectedAns === currentQ.a;
    
    if (isCorrect) {
      setFeedback('correct');
      const nextLevel = currentLevel + 1;
      if (WebApp.HapticFeedback) WebApp.HapticFeedback.impactOccurred('light');
      
      setTimeout(() => {
        setCurrentLevel(nextLevel);
        if (nextLevel > maxLevelReached) setMaxLevelReached(nextLevel);
        
        if (nextLevel >= 10) {
          endGame(); // Chiến thắng
        } else {
          setCurrentQ(getRandomQuestion());
          setFeedback(null);
        }
      }, 800);

    } else {
      setFeedback('wrong');
      if (WebApp.HapticFeedback) WebApp.HapticFeedback.notificationOccurred('error');
      
      setTimeout(() => {
        setCurrentLevel(0); // Rớt đài (Luật Nhanh Như Chớp)
        setCurrentQ(getRandomQuestion());
        setFeedback(null);
      }, 1200);
    }
  };

  // UI Components
  const LevelLadder = () => (
    <div className="w-16 bg-gray-900/50 rounded-xl p-2 flex flex-col-reverse justify-between border border-gray-800">
      {[...Array(10)].map((_, i) => {
        const level = i + 1;
        const isCurrent = level === currentLevel;
        const isPassed = level < currentLevel;
        return (
          <div 
            key={level} 
            className={`flex items-center justify-center h-8 text-sm font-bold rounded-lg transition-all
              ${isCurrent ? 'bg-yellow-500 text-black scale-110 shadow-[0_0_10px_rgba(234,179,8,0.5)]' : 
                isPassed ? 'bg-green-500/20 text-green-400' : 'text-gray-500'}
            `}
          >
            {level}
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-yellow-500/30 flex flex-col">
      {/* Header */}
      <header className="flex justify-between items-center p-4 border-b border-gray-800 bg-black/80 backdrop-blur sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <div className="bg-yellow-500 p-1.5 rounded-lg">
            <Zap size={20} className="text-black fill-current" />
          </div>
          <span className="font-bold text-lg tracking-tight">Lightning Trivia</span>
        </div>
        <div className="flex items-center gap-2 bg-gray-900 px-3 py-1.5 rounded-full border border-gray-800">
          <Star size={16} className="text-yellow-500" />
          <span className="text-sm font-medium">{user?.first_name || 'Player'}</span>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col p-4 max-w-md mx-auto w-full relative">
        
        {gameState === 'menu' && (
          <div className="flex-1 flex flex-col items-center justify-center text-center animate-in fade-in zoom-in duration-300">
            <div className="w-24 h-24 bg-yellow-500 rounded-3xl flex items-center justify-center mb-6 shadow-[0_0_40px_rgba(234,179,8,0.3)] rotate-3">
              <Zap size={48} className="text-black fill-current" />
            </div>
            <h1 className="text-4xl font-extrabold mb-2 uppercase tracking-wider text-transparent bg-clip-text bg-gradient-to-br from-yellow-400 to-yellow-600">
              Reach Level 10
            </h1>
            <p className="text-gray-400 mb-8 px-4">
              Answer 10 questions correctly in a row. One wrong answer and you drop back to zero. You have 60 seconds.
            </p>
            <button 
              onClick={startGame}
              className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-bold text-lg py-4 rounded-2xl flex items-center justify-center gap-2 transition-transform active:scale-95"
            >
              <Play size={24} className="fill-current" />
              PLAY NOW
            </button>
          </div>
        )}

        {gameState === 'playing' && currentQ && (
          <div className="flex-1 flex gap-4 animate-in fade-in duration-300">
            {/* Cột Thang Điểm */}
            <LevelLadder />

            {/* Cột Câu Hỏi */}
            <div className="flex-1 flex flex-col">
              {/* Header In-game */}
              <div className="flex justify-between items-center bg-gray-900 rounded-2xl p-4 border border-gray-800 mb-4">
                <div className="flex flex-col">
                  <span className="text-xs text-gray-500 uppercase font-bold tracking-wider">Level</span>
                  <span className="text-2xl font-black text-yellow-500">{currentLevel}/10</span>
                </div>
                <div className="flex items-center gap-2">
                  <Timer size={20} className={timeLeft <= 10 ? 'text-red-500 animate-pulse' : 'text-gray-400'} />
                  <span className={`text-2xl font-black ${timeLeft <= 10 ? 'text-red-500' : 'text-white'}`}>
                    {timeLeft}s
                  </span>
                </div>
              </div>

              {/* Câu hỏi */}
              <div className="flex-1 flex flex-col justify-center mb-4">
                <h2 className="text-2xl font-bold text-center leading-tight">
                  {currentQ.q}
                </h2>
              </div>

              {/* Phản hồi đúng/sai */}
              {feedback && (
                <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center justify-center p-6 rounded-3xl backdrop-blur-md z-20 animate-in zoom-in-50 duration-200 ${feedback === 'correct' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                  {feedback === 'correct' ? <CheckCircle2 size={64} /> : <XCircle size={64} />}
                  <span className="text-xl font-bold mt-2 uppercase">
                    {feedback === 'correct' ? 'Correct!' : 'Back to 0!'}
                  </span>
                </div>
              )}

              {/* Các nút đáp án */}
              <div className="grid gap-3 mt-auto">
                {currentQ.options.map((opt, idx) => {
                  let btnColor = "bg-gray-900 border-gray-800 text-white";
                  if (feedback !== null) {
                    if (opt === currentQ.a) btnColor = "bg-green-500 border-green-400 text-black";
                    else if (feedback === 'wrong') btnColor = "bg-red-900/50 border-red-800 text-gray-400";
                  }

                  return (
                    <button
                      key={idx}
                      onClick={() => handleAnswer(opt)}
                      disabled={feedback !== null}
                      className={`w-full p-4 rounded-2xl border text-left font-medium text-lg transition-all active:scale-95 ${btnColor}`}
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
          <div className="flex-1 flex flex-col items-center justify-center text-center animate-in slide-in-from-bottom-4 duration-300">
            <div className="w-24 h-24 bg-gray-900 rounded-full flex items-center justify-center mb-6 border-4 border-gray-800">
              <Trophy size={40} className={currentLevel >= 10 ? 'text-yellow-500' : 'text-gray-500'} />
            </div>
            
            <h2 className="text-3xl font-black mb-2">
              {currentLevel >= 10 ? 'YOU WON!' : 'TIME IS UP!'}
            </h2>
            <p className="text-gray-400 mb-8">
              Highest level reached: <span className="text-yellow-500 font-bold text-xl">{maxLevelReached}/10</span>
            </p>

            <div className="w-full space-y-3">
              <button 
                onClick={startGame}
                className="w-full bg-yellow-500 text-black font-bold text-lg py-4 rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-transform"
              >
                <RotateCcw size={20} />
                PLAY AGAIN
              </button>
              
              {/* Nút giả lập kiếm tiền AdsGram / Share */}
              <button className="w-full bg-blue-600 text-white font-bold text-lg py-4 rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-transform">
                Share Score to Earn Stars
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}