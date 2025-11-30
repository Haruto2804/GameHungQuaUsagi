// --- CẤU HÌNH & BIẾN TOÀN CỤC ---
const container = document.getElementById('game-container');
const basket = document.getElementById('basket');
const basketImg = document.getElementById('basket-img');
const scoreEl = document.getElementById('score-display');
const livesEl = document.getElementById('lives-display');
const diffLabel = document.getElementById('diff-label');

const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over');
const btnStart = document.getElementById('btn-start');
const btnRestart = document.getElementById('btn-restart');
const btnDiff = document.getElementById('btn-diff');

// Kích thước gốc của game
const BASE_WIDTH = 950;
const BASE_HEIGHT = 600;

// Các biến Audio (Giả lập)
const backgroundMusic = new Audio('./music.mp3');
backgroundMusic.loop = true;
backgroundMusic.volume = 0.5;
const soundEat = new Audio('./eat_fruit.mp3');
soundEat.volume = 0.8;
const soundDamage = new Audio('./ouch_huhu.mp3');
soundDamage.volume = 1.0;

// State game
let state = {
    isPlaying: false,
    score: 0,
    lives: 3,
    difficulty: 1, 
    speedMultiplier: 1,
    spawnRate: 1200, 
    lastTime: 0,
    mouseX: BASE_WIDTH / 2, // Tọa độ X trong không gian game (0-BASE_WIDTH)
    currentScale: 1 // Tỷ lệ co giãn hiện tại
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

/**
 * Tính toán tỷ lệ scale và áp dụng cho game container để vừa màn hình.
 */
function handleResize() {
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;

    // Tính tỷ lệ theo chiều rộng và chiều cao
    const scaleX = windowWidth / BASE_WIDTH;
    const scaleY = windowHeight / BASE_HEIGHT;

    // Chọn tỷ lệ nhỏ nhất để đảm bảo game vừa vặn và không bị cuộn
    const scale = Math.min(scaleX, scaleY);
    state.currentScale = scale;

    // Áp dụng biến CSS cho việc scale
    container.style.setProperty('--scale', scale);

    // Đặt lại vị trí rổ (quan trọng sau khi resize)
    updateBasketPos();
}

/**
 * Cập nhật vị trí rổ dựa trên state.mouseX (đã chuẩn hóa)
 */
function updateBasketPos() {
    // x là tọa độ trong không gian game gốc (0 -> BASE_WIDTH)
    let x = state.mouseX - (basket.offsetWidth / 2);
    
    // Giới hạn biên
    const maxW = BASE_WIDTH - basket.offsetWidth;
    if (x < 0) x = 0;
    if (x > maxW) x = maxW;

    basket.style.left = `${x}px`;
}

// 1. Di chuyển chuột (Desktop)
container.addEventListener('mousemove', (e) => {
    if (!state.isPlaying) return;
    const rect = container.getBoundingClientRect();
    
    // Chuyển đổi tọa độ chuột thành tọa độ game gốc
    state.mouseX = (e.clientX - rect.left) / state.currentScale;
});

// 2. Điều khiển Cảm ứng (Mobile)
function handleTouchInput(e) {
    e.preventDefault(); // Ngăn cuộn trang
    if (!state.isPlaying || e.touches.length === 0) return;

    const rect = container.getBoundingClientRect();
    // Chuyển đổi tọa độ chạm thành tọa độ game gốc
    state.mouseX = (e.touches[0].clientX - rect.left) / state.currentScale;
    updateBasketPos();
}

container.addEventListener('touchstart', handleTouchInput, { passive: false });
container.addEventListener('touchmove', handleTouchInput, { passive: false });

// 3. Thay đổi trạng thái Player (Hình ảnh & Hiệu ứng)
function setPlayerStatus(status) {
    // Xóa tất cả các hiệu ứng cũ trước khi áp dụng hiệu ứng mới
    basketImg.classList.remove('bounce', 'glowing', 'bomb-hit');
    clearTimeout(statusTimeout);
    container.classList.remove('shake-screen');

    if (status === 'happy') {
        // --- HIỆU ỨNG ĂN QUẢ TỐT ---
        basketImg.src = './player-happy.png';
        basketImg.classList.add('bounce', 'glowing'); 

        statusTimeout = setTimeout(() => {
            basketImg.src = './player.png';
            basketImg.classList.remove('bounce', 'glowing');
        }, 300);
    }
    else if (status === 'hit') {
        // --- HIỆU ỨNG DÍNH VẬT XẤU NHẸ ---
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
        // --- HIỆU ỨNG TRÚNG BOM (Nhảy, lắc mạnh, màn hình rung) ---
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
        // Trạng thái 'normal'
        basketImg.src = './player.png';
    }
}

// --- LOGIC GAME LOOP ---

function startGame() {
    // Reset biến
    state.score = 0;
    state.lives = 3;
    state.isPlaying = true;
    state.lastTime = performance.now();
    
    // Đặt lại vị trí rổ ban đầu
    state.mouseX = BASE_WIDTH / 2;

    // UI Update
    updateUI();
    setPlayerStatus('normal');
    startScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');

    // Xóa vật phẩm cũ
    document.querySelectorAll('.fruit, .bird').forEach(el => el.remove());

    // Bắt đầu Loops
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

    document.getElementById('final-score').innerText = state.score;
    gameOverScreen.classList.remove('hidden');
}

function startSpawning() {
    clearInterval(spawnerId);
    spawnerId = setInterval(() => {
        if (state.isPlaying) spawnItem();
    }, state.spawnRate);
}

// --- SPAWN SYSTEM (TẠO VẬT PHẨM & CHIM) ---

function spawnItem() {
    const itemData = ITEMS[Math.floor(Math.random() * ITEMS.length)];
    const el = document.createElement('div');

    el.classList.add('fruit');
    const classes = itemData.class.split(' ');
    el.classList.add(...classes);
    el.innerText = itemData.emoji;

    // Vị trí ngẫu nhiên (sử dụng BASE_WIDTH)
    const maxLeft = BASE_WIDTH - 50;
    el.style.left = Math.random() * maxLeft + 'px';

    el.dataset.y = -60;
    el.dataset.speed = itemData.speed * state.speedMultiplier;
    el.dataset.type = itemData.type;
    el.dataset.score = itemData.score;

    container.appendChild(el);
}

function spawnBird() {
    if (!state.isPlaying) return;
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

// --- VÒNG LẶP CHÍNH (UPDATE VỊ TRÍ & VA CHẠM) ---

function gameLoop(time) {
    if (!state.isPlaying) return;

    const deltaTime = (time - state.lastTime) / 16;
    state.lastTime = time;

    updateBasketPos();

    const fruits = document.querySelectorAll('.fruit');
    const containerHeight = BASE_HEIGHT;

    fruits.forEach(fruit => {
        let y = parseFloat(fruit.dataset.y);
        const speed = parseFloat(fruit.dataset.speed);

        // Cập nhật vị trí
        y += speed * deltaTime;
        fruit.style.top = `${y}px`;
        fruit.dataset.y = y;

        // Tính toán Rect cho fruit trong không gian game gốc
        const fruitLeft = parseFloat(fruit.style.left);
        const fruitRectGameSpace = {
            top: y,
            bottom: y + 50, 
            left: fruitLeft,
            right: fruitLeft + 50,
        };

        // Tính toán Rect cho basket trong không gian game gốc
        const basketLeft = parseFloat(basket.style.left);
        const basketRectGameSpace = {
            top: containerHeight - basket.offsetHeight - 10, // bottom: 10px
            bottom: containerHeight - 10,
            left: basketLeft,
            right: basketLeft + basket.offsetWidth,
        };


        // 1. Kiểm tra Va Chạm Rổ (Sử dụng Game Space Rects)
        if (isColliding(fruitRectGameSpace, basketRectGameSpace)) {
            handleCatch(fruit);
            return;
        }

        // 2. Kiểm tra Rơi ra ngoài
        if (y > containerHeight) {
            handleMiss(fruit);
        }
    });

    gameLoopId = requestAnimationFrame(gameLoop);
}

// Hàm kiểm tra va chạm (Sử dụng Tọa độ Game Space)
function isColliding(a, b) {
    return !(
        a.bottom < b.top + 20 || // Miệng rổ
        a.top > b.bottom ||
        a.right < b.left + 10 ||
        a.left > b.right - 10
    );
}

// --- XỬ LÝ LOGIC GAME ---

function handleCatch(el) {
    const type = el.dataset.type;
    const scoreVal = parseInt(el.dataset.score);

    el.remove();
    state.score += scoreVal;

    if (type === 'good') {
        soundEat.currentTime = 0;
        soundEat.play();
        setPlayerStatus('happy');
    } else if (type === 'bad') {
        soundDamage.currentTime = 0;
        soundDamage.play();
        setPlayerStatus('hit');
    } else if (type === 'bomb') {
        soundDamage.currentTime = 0;
        soundDamage.play();
        setPlayerStatus('bomb');
        state.lives--;
    }

    checkGameStatus();
    updateUI();
}

function handleMiss(el) {
    const type = el.dataset.type;
    el.remove();

    if (type === 'good') {
        state.lives--;
        setPlayerStatus('hit');
        checkGameStatus();
        updateUI();
    }
}

function checkGameStatus() {
    if (state.lives <= 0) {
        gameOver();
    }
}

function updateUI() {
    scoreEl.innerText = state.score;
    livesEl.innerText = '❤️'.repeat(Math.max(0, state.lives));
    changeDifficulty(false); 
}

// --- ĐIỀU KHIỂN ĐỘ KHÓ ---

function changeDifficulty(shouldCycle = true) {
    if (shouldCycle) {
        state.difficulty++;
        if (state.difficulty > 3) state.difficulty = 1;
    }

    switch (state.difficulty) {
        case 1:
            diffLabel.innerText = "Dễ";
            diffLabel.className = "text-green-500";
            state.speedMultiplier = 1;
            state.spawnRate = 1200;
            break;
        case 2:
            diffLabel.innerText = "Thường";
            diffLabel.className = "text-orange-500";
            state.speedMultiplier = 1.5;
            state.spawnRate = 900;
            break;
        case 3:
            diffLabel.innerText = "Khó";
            diffLabel.className = "text-red-600";
            state.speedMultiplier = 2.2;
            state.spawnRate = 600;
            break;
    }

    if (state.isPlaying) startSpawning();
}

// --- LOGIC ĐIỀU KHIỂN ÂM THANH ---

const elMusicToggle = document.getElementById('btn-toggle-music');
const elMusicIcon = document.getElementById('music-icon');
const elVolUp = document.getElementById('btn-vol-up');
const elVolDown = document.getElementById('btn-vol-down');
let isMusicPlaying = false;

function updateMusicIcon() {
    if (backgroundMusic.muted || backgroundMusic.volume === 0) {
        elMusicIcon.innerText = '🔇';
    } else if (isMusicPlaying) {
        elMusicIcon.innerText = '🔊';
    } else {
        elMusicIcon.innerText = '🎶';
    }
}

elMusicToggle.addEventListener('click', () => {
    if (isMusicPlaying) {
        backgroundMusic.pause();
        isMusicPlaying = false;
    } else {
        backgroundMusic.play().catch(error => {
            console.error("Không thể tự động phát nhạc:", error);
        });
        isMusicPlaying = true;
    }
    backgroundMusic.muted = false;
    updateMusicIcon();
});

elVolUp.addEventListener('click', () => {
    if (backgroundMusic.volume < 1) {
        backgroundMusic.volume = Math.min(1, backgroundMusic.volume + 0.1);
    }
    backgroundMusic.muted = false;
    updateMusicIcon();
});

elVolDown.addEventListener('click', () => {
    if (backgroundMusic.volume > 0) {
        backgroundMusic.volume = Math.max(0, backgroundMusic.volume - 0.1);
    }
    updateMusicIcon();
});


// --- SỰ KIỆN KHỞI TẠO ---
btnStart.addEventListener('click', () => {
    startGame();
    // Bật nhạc khi bắt đầu chơi lần đầu
    if (!isMusicPlaying) {
        backgroundMusic.play().catch(error => {});
        isMusicPlaying = true;
        updateMusicIcon();
    }
});
btnRestart.addEventListener('click', startGame);

btnDiff.addEventListener('click', () => changeDifficulty(true)); 

window.addEventListener('load', handleResize);
window.addEventListener('resize', handleResize);

// Khởi tạo trạng thái UI ban đầu
window.addEventListener('load', () => {
    changeDifficulty(false); // Thiết lập nhãn 'Dễ' ban đầu
    handleResize();
});