// --- CẤU HÌNH & BIẾN TOÀN CỤC ---
const container = document.getElementById('game-container');
const basket = document.getElementById('basket');
const basketImg = document.getElementById('basket-img');
const scoreEl = document.getElementById('score-display');
const livesEl = document.getElementById('lives-display');
const diffLabel = document.getElementById('diff-label');

const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over');
const pauseScreen = document.getElementById('pause-screen'); 
const btnStart = document.getElementById('btn-start');
const btnRestart = document.getElementById('btn-restart');
const btnResume = document.getElementById('btn-resume'); 
const btnPause = document.getElementById('btn-pause'); 
const btnDiff = document.getElementById('btn-diff');

// High Score DOM
const highScoreDisplay = document.getElementById('high-score-display');
const startHighScoreDisplay = document.getElementById('start-high-score');
const finalHighScoreDisplay = document.getElementById('final-high-score');

// Kích thước gốc của game
const BASE_WIDTH = 950;
const BASE_HEIGHT = 600;

// Các biến Audio (Lấy từ Pause Screen)
const elMusicToggle = document.getElementById('btn-toggle-music');
const elMusicIcon = document.getElementById('music-icon');
const elVolUp = document.getElementById('btn-vol-up');
const elVolDown = document.getElementById('btn-vol-down');

const backgroundMusic = new Audio('./music.mp3');
backgroundMusic.loop = true;
backgroundMusic.volume = 0.5;
const soundEat = new Audio('./eat_fruit.mp3');
soundEat.volume = 0.8;
const soundDamage = new Audio('./ouch_huhu.mp3');
soundDamage.volume = 1.0;
let isMusicPlaying = false; 

// State game
let state = {
    isPlaying: false,
    isPaused: false, 
    score: 0,
    lives: 3,
    highScore: 0, 
    difficulty: 1, 
    speedMultiplier: 1,
    spawnRate: 1200, 
    lastTime: 0,
    mouseX: BASE_WIDTH / 2, 
    currentScale: 1,
    moveDirection: 0,
};

// Quản lý Loop & Interval
let gameLoopId = null;
let spawnerId = null;
let birdSpawnerId = null;
let statusTimeout = null;

// Dữ liệu Vật phẩm
const ITEMS = [
    { type: 'good', emoji: '🍎', score: 10, speed: 3, class: 'bg-red-500 text-white rounded-full border-2 border-white' },
    { type: 'good', emoji: '🍌', score: 15, speed: 4, class: 'bg-yellow-300 text-yellow-900 rounded-full border-2 border-white' },
    { type: 'good', emoji: '🍓', score: 20, speed: 5, class: 'bg-pink-500 text-white rounded-full border-2 border-white' },
    { type: 'bad', emoji: '🗿', score: -5, speed: 6, class: 'bg-gray-500 text-white rounded-lg border-2 border-gray-700' },
    { type: 'bomb', emoji: '💣', score: -50, speed: 7, class: 'bg-black text-red-500 rounded-full border-2 border-red-500 animate-pulse' }
];

// --- HỆ THỐNG ĐIỀU KHIỂN & RESPONSIVE ---

function handleResize() {
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    const BASE_WIDTH = 950;
    const BASE_HEIGHT = 600;
    const scaleX = windowWidth / BASE_WIDTH;
    const scaleY = windowHeight / BASE_HEIGHT;
    
    let scale = Math.min(scaleX, scaleY);
    
    // ĐIỀU CHỈNH: Áp dụng hệ số đệm 98% để tối đa hóa màn hình
    const paddingFactor = 0.98; 
    scale *= paddingFactor;
    
    state.currentScale = scale;
    container.style.setProperty('--scale', scale);
    updateBasketPos();
}

function updateBasketPos() {
    if (state.moveDirection !== 0) {
        const moveSpeed = 10;
        state.mouseX += state.moveDirection * moveSpeed;
    }

    let x = state.mouseX - (basket.offsetWidth / 2);
    const maxW = BASE_WIDTH - basket.offsetWidth;
    
    if (x < 0) x = 0;
    if (x > maxW) x = maxW;
    
    state.mouseX = x + (basket.offsetWidth / 2); 
    basket.style.left = `${x}px`;
}

// 1. Di chuyển chuột (Desktop)
container.addEventListener('mousemove', (e) => {
    if (!state.isPlaying || state.isPaused) return;
    const rect = container.getBoundingClientRect();
    state.mouseX = (e.clientX - rect.left) / state.currentScale;
});

// 2. Điều khiển Cảm ứng (Touch)
function handleTouchInput(e) {
    e.preventDefault(); 
    if (!state.isPlaying || state.isPaused || e.touches.length === 0) return;
    const rect = container.getBoundingClientRect();
    state.mouseX = (e.touches[0].clientX - rect.left) / state.currentScale;
    updateBasketPos();
}
container.addEventListener('touchstart', handleTouchInput, { passive: false });
container.addEventListener('touchmove', handleTouchInput, { passive: false });


// 3. Virtual Control Buttons
const btnMoveLeft = document.getElementById('btn-move-left');
const btnMoveRight = document.getElementById('btn-move-right');

function handleMoveStart(direction) {
    return (e) => {
        e.preventDefault();
        if (!state.isPlaying || state.isPaused) return;
        state.moveDirection = direction;
    };
}

function handleMoveEnd(e) {
    e.preventDefault();
    state.moveDirection = 0;
}

btnMoveLeft.addEventListener('mousedown', handleMoveStart(-1));
btnMoveRight.addEventListener('mousedown', handleMoveStart(1));
btnMoveLeft.addEventListener('mouseup', handleMoveEnd);
btnMoveRight.addEventListener('mouseup', handleMoveEnd);
btnMoveLeft.addEventListener('mouseleave', handleMoveEnd);
btnMoveRight.addEventListener('mouseleave', handleMoveEnd);

btnMoveLeft.addEventListener('touchstart', handleMoveStart(-1), { passive: false });
btnMoveRight.addEventListener('touchstart', handleMoveStart(1), { passive: false });
btnMoveLeft.addEventListener('touchend', handleMoveEnd);
btnMoveRight.addEventListener('touchend', handleMoveEnd);


// 4. Thay đổi trạng thái Player 
function setPlayerStatus(status) {
    basketImg.classList.remove('bounce', 'glowing', 'bomb-hit');
    clearTimeout(statusTimeout);
    container.classList.remove('shake-screen');

    if (status === 'happy') {
        basketImg.src = './player-happy.png';
        basketImg.classList.add('bounce', 'glowing'); 
        statusTimeout = setTimeout(() => {
            basketImg.src = './player.png';
            basketImg.classList.remove('bounce', 'glowing');
        }, 300);
    }
    else if (status === 'hit') {
        basketImg.src = './player-hurt.png';
        basketImg.classList.add('bounce'); 
        container.classList.add('shake-screen');
        setTimeout(() => container.classList.remove('shake-screen'), 500);
        statusTimeout = setTimeout(() => {
            basketImg.src = './player.png';
            basketImg.classList.remove('bounce');
        }, 400);
    }
    else if (status === 'bomb') {
        basketImg.src = './player-hurt.png';
        basketImg.classList.add('bounce', 'bomb-hit'); 
        container.classList.add('shake-screen');
        setTimeout(() => container.classList.remove('shake-screen'), 800);
        statusTimeout = setTimeout(() => {
            basketImg.src = './player.png';
            basketImg.classList.remove('bounce', 'bomb-hit'); 
        }, 800);
    }
    else {
        basketImg.src = './player.png';
    }
}

// --- LOGIC PAUSE/RESUME ---
function togglePause() {
    if (!state.isPlaying) return;

    if (state.isPaused) {
        resumeGame();
    } else {
        pauseGame();
    }
}

function pauseGame() {
    state.isPaused = true;
    clearInterval(spawnerId);
    clearInterval(birdSpawnerId);
    
    cancelAnimationFrame(gameLoopId);
    backgroundMusic.pause();
    
    document.getElementById('current-score-pause').innerText = state.score;
    pauseScreen.classList.remove('hidden');
}

function resumeGame() {
    state.isPaused = false;
    pauseScreen.classList.add('hidden');

    state.lastTime = performance.now();
    gameLoopId = requestAnimationFrame(gameLoop);
    
    startSpawning();
    birdSpawnerId = setInterval(spawnBird, 5000); 
    
    if (isMusicPlaying) backgroundMusic.play().catch(error => {});
}

// --- LOGIC GAME LOOP ---

function startGame() {
    loadHighScore();
    
    state.score = 0;
    state.lives = 3;
    state.isPlaying = true;
    state.isPaused = false; 
    state.lastTime = performance.now();
    state.mouseX = BASE_WIDTH / 2;
    state.difficulty = 1; 

    updateUI();
    setPlayerStatus('normal');
    startScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    pauseScreen.classList.add('hidden'); 
    
    document.querySelectorAll('.fruit, .bird').forEach(el => el.remove());

    gameLoopId = requestAnimationFrame(gameLoop);
    startSpawning();
    
    clearInterval(birdSpawnerId);
    birdSpawnerId = setInterval(spawnBird, 5000); 
}

function gameOver() {
    state.isPlaying = false;
    
    cancelAnimationFrame(gameLoopId);
    clearInterval(spawnerId);
    clearInterval(birdSpawnerId);
    backgroundMusic.pause();

    saveHighScore(state.score);
    finalHighScoreDisplay.innerText = state.highScore;

    document.getElementById('final-score').innerText = state.score;
    gameOverScreen.classList.remove('hidden');
}

function startSpawning() {
    clearInterval(spawnerId); 
    spawnerId = setInterval(() => {
        if (state.isPlaying && !state.isPaused) spawnItem();
    }, state.spawnRate);
}

// --- CORE GAME LOOP ---

function gameLoop(time) {
    if (!state.isPlaying || state.isPaused) {
         state.lastTime = time;
         return; 
    }

    const deltaTime = (time - state.lastTime) / 16;
    state.lastTime = time;

    updateBasketPos();

    const fruits = document.querySelectorAll('.fruit');
    const containerHeight = BASE_HEIGHT;

    fruits.forEach(fruit => {
        let y = parseFloat(fruit.dataset.y);
        const speed = parseFloat(fruit.dataset.speed);

        y += speed * deltaTime;
        fruit.style.top = `${y}px`;
        fruit.dataset.y = y;

        const fruitLeft = parseFloat(fruit.style.left);
        const fruitRectGameSpace = { top: y, bottom: y + 50, left: fruitLeft, right: fruitLeft + 50 };
        const basketLeft = parseFloat(basket.style.left);
        const basketRectGameSpace = { 
            top: containerHeight - basket.offsetHeight - 10, 
            bottom: containerHeight - 10, 
            left: basketLeft, 
            right: basketLeft + basket.offsetWidth 
        };

        if (isColliding(fruitRectGameSpace, basketRectGameSpace)) {
            handleCatch(fruit);
            return;
        }

        if (y > containerHeight) {
            handleMiss(fruit);
        }
    });

    gameLoopId = requestAnimationFrame(gameLoop);
}

// Hàm kiểm tra va chạm (Giữ nguyên)
function isColliding(a, b) {
    return !(
        a.bottom < b.top + 20 || 
        a.top > b.bottom ||
        a.right < b.left + 10 ||
        a.left > b.right - 10
    );
}

// --- HIGH SCORE LOGIC ---
function loadHighScore() {
    const storedScore = localStorage.getItem('fruitCatchHighScore');
    state.highScore = storedScore ? parseInt(storedScore) : 0;
    startHighScoreDisplay.innerText = state.highScore;
    highScoreDisplay.innerText = state.highScore;
    
    isMusicPlaying = true;
    updateMusicIcon();
}

function saveHighScore(currentScore) {
    if (currentScore > state.highScore) {
        state.highScore = currentScore;
        localStorage.setItem('fruitCatchHighScore', currentScore);
    }
    highScoreDisplay.innerText = state.highScore;
}

// --- XỬ LÝ LOGIC GAME & UTILS ---
function handleCatch(el) {
    const type = el.dataset.type;
    const scoreVal = parseInt(el.dataset.score);
    el.remove();
    state.score += scoreVal;
    if (type === 'good') {
        soundEat.currentTime = 0; soundEat.play(); setPlayerStatus('happy');
    } else if (type === 'bad') {
        soundDamage.currentTime = 0; soundDamage.play(); setPlayerStatus('hit');
    } else if (type === 'bomb') {
        soundDamage.currentTime = 0; soundDamage.play(); setPlayerStatus('bomb'); state.lives--;
    }
    checkGameStatus(); updateUI();
}

function handleMiss(el) {
    const type = el.dataset.type;
    el.remove();
    if (type === 'good') {
        state.lives--; setPlayerStatus('hit'); checkGameStatus(); updateUI();
    }
}

function checkGameStatus() {
    if (state.lives <= 0) { gameOver(); }
}

function updateUI() {
    scoreEl.innerText = state.score;
    livesEl.innerText = '❤️'.repeat(Math.max(0, state.lives));
    changeDifficulty(false); 
}

function spawnItem() {
    const itemData = ITEMS[Math.floor(Math.random() * ITEMS.length)];
    const el = document.createElement('div');
    el.classList.add('fruit', ...itemData.class.split(' '));
    el.innerText = itemData.emoji;
    const maxLeft = BASE_WIDTH - 50;
    el.style.left = Math.random() * maxLeft + 'px';
    el.dataset.y = -60;
    el.dataset.speed = itemData.speed * state.speedMultiplier;
    el.dataset.type = itemData.type;
    el.dataset.score = itemData.score;
    container.appendChild(el);
}

function spawnBird() {
    if (!state.isPlaying || state.isPaused) return;
    const bird = document.createElement('div');
    bird.classList.add('bird');
    bird.innerText = Math.random() > 0.5 ? '🐦' : '🕊️';
    const topPos = 50 + Math.random() * 200;
    bird.style.top = `${topPos}px`;
    const duration = 4 + Math.random() * 4;
    bird.style.animation = `flyRight ${duration}s linear`;
    container.appendChild(bird);
    setTimeout(() => {
        if (bird.parentNode) bird.remove();
    }, duration * 1000);
}

function changeDifficulty(shouldCycle = true) {
    if (shouldCycle) {
        state.difficulty++;
        if (state.difficulty > 3) state.difficulty = 1;
    }
    switch (state.difficulty) {
        case 1:
            diffLabel.innerText = "Dễ"; diffLabel.className = "text-green-500"; state.speedMultiplier = 1; state.spawnRate = 1200; break;
        case 2:
            diffLabel.innerText = "Thường"; diffLabel.className = "text-orange-500"; state.speedMultiplier = 1.5; state.spawnRate = 900; break;
        case 3:
            diffLabel.innerText = "Khó"; diffLabel.className = "text-red-600"; state.speedMultiplier = 2.2; state.spawnRate = 600; break;
    }
    if (state.isPlaying && !state.isPaused) startSpawning(); 
}

// --- LOGIC ĐIỀU KHIỂN ÂM THANH ---

function updateMusicIcon() {
    if (backgroundMusic.muted || backgroundMusic.volume === 0) { elMusicIcon.innerText = '🔇'; } 
    else if (isMusicPlaying) { elMusicIcon.innerText = '🔊'; } 
    else { elMusicIcon.innerText = '🎶'; }
}

elMusicToggle.addEventListener('click', () => {
    if (isMusicPlaying) { backgroundMusic.pause(); isMusicPlaying = false; } 
    else { backgroundMusic.play().catch(error => {}); isMusicPlaying = true; }
    backgroundMusic.muted = false;
    updateMusicIcon();
});
elVolUp.addEventListener('click', () => {
    if (backgroundMusic.volume < 1) { backgroundMusic.volume = Math.min(1, backgroundMusic.volume + 0.1); }
    backgroundMusic.muted = false; updateMusicIcon();
});
elVolDown.addEventListener('click', () => {
    if (backgroundMusic.volume > 0) { backgroundMusic.volume = Math.max(0, backgroundMusic.volume - 0.1); }
    updateMusicIcon();
});


// --- SỰ KIỆN KHỞI TẠO ---
btnStart.addEventListener('click', () => {
    startGame();
    // Bật nhạc khi bắt đầu chơi (do isMusicPlaying = true từ loadHighScore)
    if (isMusicPlaying) { backgroundMusic.play().catch(error => {}); }
    updateMusicIcon(); 
});

btnRestart.addEventListener('click', () => {
    startGame();
    if (isMusicPlaying) { backgroundMusic.play().catch(error => {}); }
    updateMusicIcon(); 
});

// Sự kiện Pause/Resume
btnPause.addEventListener('click', togglePause);
btnResume.addEventListener('click', resumeGame);

btnDiff.addEventListener('click', () => changeDifficulty(true)); 

window.addEventListener('load', () => {
    loadHighScore(); 
    changeDifficulty(false); 
    handleResize();
});
window.addEventListener('resize', handleResize);