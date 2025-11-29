import React, { useState, useRef, useEffect, useCallback } from 'react';

// === Cấu hình Game (Hằng số) ===
const PLAYER_SIZE = 90; // Kích thước rổ (Basket Size)
const PLAYER_HEIGHT_RATIO = 0.2; // Tỷ lệ chiều cao rổ so với kích thước (Height ratio of the basket)
const MOVEMENT_SPEED = 7; // Tốc độ di chuyển của rổ (Movement Speed)
const FRUIT_SIZE = 48; // Kích thước quả (Fruit Size)
const FALL_SPEED_MIN = 1; // Tốc độ rơi tối thiểu (Min Fall Speed)
const FALL_SPEED_MAX = 3; // Tốc độ rơi tối đa (Max Fall Speed)
const FRUIT_SPAWN_INTERVAL = 70; // Spawn quả sau mỗi X frames (Fruit Spawn Interval)
// MAX_MISSED_FRUITS đã bị loại bỏ

// Khu vực game sẽ responsive
const GAME_WIDTH_PERCENT = 90; 
const GAME_MAX_WIDTH = 800; // Chiều rộng tối đa của khu vực game (Max Game Width)
const GAME_ASPECT_RATIO = 16 / 9; // Tỷ lệ khung hình của game area (Game Aspect Ratio)

// Danh sách các quả (dùng Emoji)
const FRUIT_EMOJIS = ['🍎', '🍌', '🍇', '🍒', '🍊', '🥝', '🍓', '🍍'];

// === Component Quả Rơi ===
function FallingFruit({ fruit, gameContainerRect }) {
  const xPercent = (fruit.x / gameContainerRect.width) * 100;

  return (
    <div
      className={`absolute text-4xl select-none ${fruit.isCaught ? 'opacity-0 scale-150 transition-all duration-200 ease-out' : 'opacity-100'}`}
      style={{
        left: `${xPercent}px`, // SỬA: Dùng px thay vì % để căn chỉnh tốt hơn sau khi đã tính toán X tuyệt đối
        top: `${fruit.y}px`,
        width: `${FRUIT_SIZE}px`,
        height: `${FRUIT_SIZE}px`,
        transform: 'translateX(-50%)', 
        zIndex: 5,
      }}
    >
      {fruit.emoji}
    </div>
  );
}

// === Component Hiệu ứng Bắt được Quả ===
function CatchEffect({ id, x, y, emoji, onComplete }) {
  const [position, setPosition] = useState({x, y});
  const [opacity, setOpacity] = useState(1);

  useEffect(() => {
    // Hiệu ứng bay lên và mờ dần
    const timeout = setTimeout(() => {
      setOpacity(0);
      setPosition(prev => ({ ...prev, y: prev.y - 50 })); // Bay lên 50px
    }, 100);

    // Xóa hiệu ứng sau khi hoàn thành
    const fadeOutTimeout = setTimeout(() => {
      onComplete(id);
    }, 500); // Tổng thời gian hiệu ứng

    return () => {
      clearTimeout(timeout);
      clearTimeout(fadeOutTimeout);
    };
  }, [id, onComplete]);

  return (
    <div 
      className="absolute text-2xl font-bold transition-all duration-500 ease-out pointer-events-none z-10"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        opacity: opacity,
        transform: 'translateX(-50%)', // SỬA: Giữ transform -50% vì x là tâm
      }}
    >
      +1 {emoji}
    </div>
  );
}


// === Component Chính ===
function App() {
  const [playerPosition, setPlayerPosition] = useState(0); 
  const [fruits, setFruits] = useState([]); 
  const [score, setScore] = useState(0); 
  const [frame, setFrame] = useState(0); 
  const [gameState, setGameState] = useState('READY'); // 'READY', 'RUNNING', 'GAMEOVER'
  const [catchEffects, setCatchEffects] = useState([]); // Hiệu ứng khi bắt được quả

  const keysRef = useRef({});
  const animationFrameRef = useRef();
  const gameAreaRef = useRef(null); 
  const gameContainerRect = useRef({ width: 0, height: 0 });

  // === Xử lý Input ===
  const handleKeyDown = useCallback((e) => {
    if (e.code === 'ArrowLeft' || e.code === 'ArrowRight' || e.code === 'KeyA' || e.code === 'KeyD') {
      keysRef.current[e.code] = true;
      e.preventDefault();
    }
  }, []);

  const handleKeyUp = useCallback((e) => {
    if (e.code === 'ArrowLeft' || e.code === 'ArrowRight' || e.code === 'KeyA' || e.code === 'KeyD') {
      keysRef.current[e.code] = false;
    }
  }, []);

  // Cập nhật kích thước Game Area
  useEffect(() => {
    const updateGameRect = () => {
      if (gameAreaRef.current) {
        const rect = gameAreaRef.current.getBoundingClientRect();
        gameContainerRect.current = { width: rect.width, height: rect.height };
      }
    };
    
    updateGameRect();
    window.addEventListener('resize', updateGameRect);
    return () => window.removeEventListener('resize', updateGameRect);
  }, []);

  // === Game Loop ===
  const gameLoop = useCallback(() => {
    // Chỉ chạy game loop khi đang ở trạng thái RUNNING
    if (gameState !== 'RUNNING' || !gameAreaRef.current) {
      animationFrameRef.current = requestAnimationFrame(gameLoop);
      return;
    }

    const { width, height } = gameContainerRect.current;
    
    // 1. Cập nhật vị trí người chơi
    let dx = 0;
    if (keysRef.current["ArrowLeft"] || keysRef.current["KeyA"]) {
      dx -= MOVEMENT_SPEED;
    }
    if (keysRef.current["ArrowRight"] || keysRef.current["KeyD"]) {
      dx += MOVEMENT_SPEED;
    }

    if (dx !== 0) {
      setPlayerPosition(prevPos => {
        // CẢI THIỆN LỖI DI CHUYỂN: Dùng width / 2 làm giới hạn di chuyển chính xác hơn.
        // Giới hạn maxOffset là nửa chiều rộng game area trừ đi nửa chiều rộng rổ
        const maxOffset = (width / 2) - (PLAYER_SIZE / 2);
        let newPos = prevPos + dx;
        
        // Đảm bảo không vượt quá biên:
        if (newPos > maxOffset) newPos = maxOffset;
        if (newPos < -maxOffset) newPos = -maxOffset;
        
        return newPos;
      });
    }

    // 2. Cập nhật vị trí và va chạm của Quả
    setFruits(prevFruits => {
      const newFruits = [];
      const playerAbsoluteX = width / 2 + playerPosition; // Vị trí X tuyệt đối của TÂM rổ
      
      // Vị trí Y rổ
      const playerTopY = height - (PLAYER_SIZE * PLAYER_HEIGHT_RATIO); // Cạnh trên của rổ
      const playerBottomY = height;

      for (const fruit of prevFruits) {
        if (fruit.isCaught) { 
          newFruits.push(fruit);
          continue;
        }

        fruit.y += fruit.speed;

        // Va chạm Y: Quả nằm trong phạm vi Y của rổ
        const isTouchingPlayerY = fruit.y + FRUIT_SIZE >= playerTopY && fruit.y <= playerBottomY;
        
        // SỬA LỖI VA CHẠM X: Tính khoảng cách giữa tâm quả và tâm rổ
        const centerDistanceX = Math.abs(fruit.x - playerAbsoluteX);
        const collisionThresholdX = (FRUIT_SIZE / 2) + (PLAYER_SIZE / 2); // Tổng nửa chiều rộng của quả và rổ
        
        // Va chạm X: Khoảng cách giữa 2 tâm nhỏ hơn tổng 2 nửa kích thước
        // CÁCH 2 (Đơn giản hơn): Quả có tâm X nằm trong rổ
        const isTouchingPlayerX = fruit.x >= playerAbsoluteX - PLAYER_SIZE / 2 && fruit.x <= playerAbsoluteX + PLAYER_SIZE / 2;


        if (isTouchingPlayerY && isTouchingPlayerX) { // Vẫn dùng cách đơn giản là tâm quả phải nằm trong rổ
          // Bắt thành công!
          setScore(s => s + 1); // Cộng điểm
          setCatchEffects(prevEffects => [...prevEffects, { id: Date.now() + Math.random(), x: fruit.x, y: fruit.y, emoji: fruit.emoji }]);
          fruit.isCaught = true; 
          newFruits.push(fruit);
        } else if (fruit.y > height) {
          // Quả rơi xuống đáy màn hình (lỡ) -> Loại bỏ khỏi màn hình
          
        } else {
          // Quả tiếp tục rơi
          newFruits.push(fruit);
        }
      }

      // Loại bỏ các quả đã được bắt (fruit.isCaught) hoặc đã rơi qua khỏi đáy màn hình
      return newFruits.filter(f => !f.isCaught && f.y <= height + FRUIT_SIZE);
    });
    
    // 3. Spawn Quả
    setFrame(prevFrame => {
      const nextFrame = (prevFrame + 1) % FRUIT_SPAWN_INTERVAL;
      if (nextFrame === 0) {
        const randomX = Math.random() * width; // Vị trí X tuyệt đối (Tâm quả)
        const randomEmoji = FRUIT_EMOJIS[Math.floor(Math.random() * FRUIT_EMOJIS.length)];
        const randomSpeed = FALL_SPEED_MIN + Math.random() * (FALL_SPEED_MAX - FALL_SPEED_MIN); 
        
        setFruits(prevFruits => [...prevFruits, {
          id: Date.now() + Math.random(),
          x: randomX, 
          y: -FRUIT_SIZE, // Bắt đầu rơi từ trên
          speed: randomSpeed,
          emoji: randomEmoji,
          isCaught: false, 
        }]);
      }
      return nextFrame;
    });

    // 4. Lặp lại vòng lặp
    animationFrameRef.current = requestAnimationFrame(gameLoop);
  }, [gameState]); 

  // === useEffect: Khởi tạo và Dọn dẹp ===
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    animationFrameRef.current = requestAnimationFrame(gameLoop);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      cancelAnimationFrame(animationFrameRef.current); 
    };
  }, [gameLoop, handleKeyDown, handleKeyUp]); 

  // Xử lý nút Chơi Lại / Bắt đầu
  const handleRestart = () => {
    setPlayerPosition(0);
    setFruits([]);
    setScore(0);
    setFrame(0);
    setCatchEffects([]);
    setGameState('RUNNING'); // Bắt đầu game
  };

  // Xử lý xóa hiệu ứng bắt được
  const handleCatchEffectComplete = useCallback((id) => {
    setCatchEffects(prevEffects => prevEffects.filter(effect => effect.id !== id));
  }, []);

  // Chức năng nút bấm trên màn hình (dành cho thiết bị di động/touch)
  const handleTouchDown = (code) => {
    if (gameState === 'RUNNING') keysRef.current[code] = true;
  };

  const handleTouchUp = (code) => {
    if (gameState === 'RUNNING') keysRef.current[code] = false;
  };
  
  // Nút tạm dừng/dừng chơi (Game Over)
  const handlePauseOrStop = () => {
      if (gameState === 'RUNNING') {
          setGameState('GAMEOVER'); // Tạm dừng game để người chơi thấy điểm
      } else if (gameState === 'GAMEOVER') {
          handleRestart(); // Chơi lại
      }
  };


  return (
    // Thêm style cho font pixel art trực tiếp vào đây, giả sử font đã được load
    <div className="relative bg-gradient-to-br from-slate-900 to-gray-950 h-screen w-screen text-white flex flex-col items-center justify-center p-4 overflow-hidden" style={{ fontFamily: '"Press Start 2P", cursive' }}>
      <h1 className="text-4xl md:text-5xl font-extrabold mb-6 text-yellow-300 drop-shadow-lg animate-fade-in">FRUIT CATCHER! 🍒</h1>
      
      {/* Score and Pause Button */}
      <div className="flex justify-between w-full max-w-lg md:max-w-xl mb-4 p-3 bg-gradient-to-r from-teal-600 to-blue-700 rounded-xl shadow-lg border-2 border-white/20 z-20">
        <div className="text-2xl font-bold">
          Score: <span className="text-yellow-200">{score}</span>
        </div>
        
        {/* Nút tạm dừng/dừng chơi */}
        {gameState === 'RUNNING' && (
             <button
                onClick={handlePauseOrStop}
                className="bg-red-500 hover:bg-red-600 text-white text-base font-bold py-1 px-3 rounded-md transition duration-200 active:scale-95 shadow-md"
            >
                DỪNG
            </button>
        )}
      </div>

      {/* Game Area */}
      <div 
        ref={gameAreaRef} 
        className={`relative bg-gradient-to-b from-blue-700 to-blue-900 shadow-2xl rounded-xl border-4 border-blue-400 overflow-hidden 
                    w-[${GAME_WIDTH_PERCENT}%] max-w-[${GAME_MAX_WIDTH}px]`}
        style={{ aspectRatio: `${GAME_ASPECT_RATIO}` }}
      >
        {/* Sky / Background elements */}
        <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-blue-400 to-blue-700 z-0"></div>
        <div className="absolute top-5 left-10 text-5xl animate-pulse delay-1000">☁️</div>
        <div className="absolute top-1/4 right-1/4 text-6xl animate-pulse delay-500">☁️</div>

        {/* === Hiển thị Quả Rơi === */}
        {gameContainerRect.current && fruits.map(fruit => (
          <FallingFruit 
            key={fruit.id} 
            fruit={fruit} 
            gameContainerRect={gameContainerRect.current} 
          />
        ))}

        {/* === Hiển thị hiệu ứng bắt được quả === */}
        {catchEffects.map(effect => (
          <CatchEffect
            key={effect.id}
            id={effect.id}
            x={effect.x}
            y={effect.y}
            emoji={effect.emoji}
            onComplete={handleCatchEffectComplete}
          />
        ))}

        {/* === Player Character (Cái Rổ) === */}
        <div 
          className="absolute bottom-0 bg-yellow-500 shadow-xl rounded-t-xl transition-transform duration-100 ease-linear flex items-center justify-center text-sm font-bold text-slate-900 border-t-4 border-yellow-300 z-10" 
          style={{ 
            width: `${PLAYER_SIZE}px`,
            height: `${PLAYER_SIZE * PLAYER_HEIGHT_RATIO}px`, 
            transform: `translateX(calc(${playerPosition}px - 50%))` 
          }}
        >
          🧺
        </div>

        {/* === Màn hình READY / GAME OVER === */}
        {(gameState === 'GAMEOVER' || gameState === 'READY') && (
          <div className="absolute inset-0 bg-slate-900/95 flex flex-col items-center justify-center z-20 p-4 animate-fade-in">
            {gameState === 'GAMEOVER' ? (
              <>
                <p className="text-6xl font-extrabold text-red-500 mb-4 animate-pulse">GAME OVER!</p>
                <p className="text-3xl mb-8 text-white">Điểm cuối: <span className="text-yellow-300 font-bold">{score}</span></p>
                <button
                    onClick={handleRestart}
                    className="bg-green-600 hover:bg-green-500 text-white font-bold py-4 px-10 rounded-full shadow-lg transition duration-200 active:scale-95 text-2xl animate-bounce-slow"
                >
                    CHƠI LẠI
                </button>
              </>
            ) : (
              // Trạng thái READY
              <>
                <p className="text-5xl font-extrabold text-green-400 mb-8 animate-pulse">BẮT ĐẦU!</p>
                <button
                    onClick={handleRestart}
                    className="bg-green-600 hover:bg-green-500 text-white font-bold py-4 px-10 rounded-full shadow-lg transition duration-200 active:scale-95 text-2xl animate-bounce-slow"
                >
                    BẮT ĐẦU
                </button>
              </>
            )}
            
            <p className="text-slate-400 mt-6 text-xl">Dùng A/D hoặc ⬅️/➡️ để di chuyển</p>
          </div>
        )}
      </div>

      {/* Control Buttons for Touch Devices */}
      <div className="mt-8 p-4 bg-slate-800 rounded-2xl shadow-xl flex gap-16 md:gap-24 z-20 border border-slate-700">
        <button
          onTouchStart={() => handleTouchDown('ArrowLeft')}
          onTouchEnd={() => handleTouchUp('ArrowLeft')}
          onMouseDown={() => handleTouchDown('ArrowLeft')}
          onMouseUp={() => handleTouchUp('ArrowLeft')}
          className="bg-blue-600 p-5 rounded-full shadow-lg hover:bg-blue-500 transition duration-150 active:scale-90 flex items-center justify-center transform hover:-translate-x-1"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-white"><path d="m15 18-6-6 6-6"/></svg>
        </button>
        <button
          onTouchStart={() => handleTouchDown('ArrowRight')}
          onTouchEnd={() => handleTouchUp('ArrowRight')}
          onMouseDown={() => handleTouchDown('ArrowRight')}
          onMouseUp={() => handleTouchUp('ArrowRight')}
          className="bg-blue-600 p-5 rounded-full shadow-lg hover:bg-blue-500 transition duration-150 active:scale-90 flex items-center justify-center transform hover:translate-x-1"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-white"><path d="m9 18 6-6-6-6"/></svg>
        </button>
      </div>
      
      <p className="text-sm mt-4 text-slate-400">Trò chơi được tạo với React & Tailwind CSS</p>

      {/* Định nghĩa các keyframes CSS cần thiết (Tailwind không hỗ trợ định nghĩa keyframes trong JSX) */}
      <style>{`
        /* Thêm các keyframes cần thiết cho animation Tailwind mà không có file CSS riêng */
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in { animation: fadeIn 0.5s ease-out forwards; }

        @keyframes bounceSlow {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        .animate-bounce-slow { animation: bounceSlow 2s infinite ease-in-out; }
      `}</style>
    </div>
  );
}

export default App;