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

// State game
let state = {
  isPlaying: false,
  score: 0,
  lives: 3,
  difficulty: 1, // 1: Dễ, 2: Thường, 3: Khó
  speedMultiplier: 1,
  spawnRate: 1200, // ms
  lastTime: 0,
  mouseX: 0
};

// Quản lý Loop & Interval
let gameLoopId = null;
let spawnerId = null;
let birdSpawnerId = null;

// Dữ liệu Vật phẩm
// classes: CSS Tailwind + kích thước
const ITEMS = [
  { type: 'good', emoji: '🍎', score: 10, speed: 3, class: 'bg-red-500 text-white rounded-full border-2 border-white' },
  { type: 'good', emoji: '🍌', score: 15, speed: 4, class: 'bg-yellow-300 text-yellow-900 rounded-full border-2 border-white' },
  { type: 'good', emoji: '🍓', score: 20, speed: 5, class: 'bg-pink-500 text-white rounded-full border-2 border-white' },
  { type: 'bad', emoji: '🗿', score: -5, speed: 6, class: 'bg-gray-500 text-white rounded-lg border-2 border-gray-700' },
  { type: 'bomb', emoji: '💣', score: -50, speed: 7, class: 'bg-black text-red-500 rounded-full border-2 border-red-500 animate-pulse' }
];

// --- HỆ THỐNG ĐIỀU KHIỂN ---

// 1. Di chuyển chuột (Sử dụng requestAnimationFrame để mượt mà)
container.addEventListener('mousemove', (e) => {
  if (!state.isPlaying) return;
  const rect = container.getBoundingClientRect();
  state.mouseX = e.clientX - rect.left;
});

function updateBasketPos() {
  // Căn giữa rổ vào chuột
  let x = state.mouseX - (basket.offsetWidth / 2);
  // Giới hạn biên
  const maxW = container.offsetWidth - basket.offsetWidth;
  if (x < 0) x = 0;
  if (x > maxW) x = maxW;

  basket.style.left = `${x}px`;
}

// 2. Thay đổi trạng thái Player (Hình ảnh & Hiệu ứng)
let statusTimeout = null;

function setPlayerStatus(status) {
  // Đảm bảo basketImg và container đã được khai báo ở phạm vi toàn cục.
  // Lưu ý: statusTimeout cần được khai báo bằng 'let statusTimeout;' ở phạm vi toàn cục hoặc bên ngoài hàm này.

  // Reset hiệu ứng cũ
  basketImg.classList.remove('bounce', 'glowing', 'bomb-hit');
  clearTimeout(statusTimeout);

  // Xóa rung màn hình nếu đang rung dở
  container.classList.remove('shake-screen');

  if (status === 'happy') {
    basketImg.src = './playervuimung.png';
    basketImg.classList.add('bounce', 'glowing');

    statusTimeout = setTimeout(() => {
      basketImg.src = './player.png';
      basketImg.classList.remove('bounce', 'glowing');
    }, 300);
  }
  else if (status === 'hit') {
    // --- CHỈNH SỬA TRẠNG THÁI 'HIT' ---

    basketImg.src = './playerkhoc.png';

    // 1. THÊM HIỆU ỨNG NHẢY (bounce)
    basketImg.classList.add('bounce');

    // 2. Rung nhẹ màn hình (Giữ nguyên)
    container.classList.add('shake-screen');

    // Loại bỏ rung màn hình sau 500ms
    setTimeout(() => container.classList.remove('shake-screen'), 500);

    // Reset về bình thường sau 400ms
    statusTimeout = setTimeout(() => {
      basketImg.src = './player.png';
      // 3. XÓA HIỆU ỨNG NHẢY khi reset
      basketImg.classList.remove('bounce');
    }, 400);
  }
  else if (status === 'bomb') {
    // --- HIỆU ỨNG TRÚNG BOM (Giữ nguyên) ---

    // 1. Dùng hình khóc
    basketImg.src = './playerkhoc.png';

    // 2. Thêm class tạo hiệu ứng cháy đen + rung xoay
    basketImg.classList.add('bomb-hit');

    // 3. Rung cả màn hình game
    container.classList.add('shake-screen');
    setTimeout(() => container.classList.remove('shake-screen'), 800);

    // 4. Reset về bình thường sau 800ms
    statusTimeout = setTimeout(() => {
      basketImg.src = './player.png';
      basketImg.classList.remove('bomb-hit');
    }, 800);
  }
  else {
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

  // Bắt đầu tạo chim (5s một con)
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

  // Style cơ bản
  el.classList.add('fruit');
  // Style riêng (màu sắc)
  const classes = itemData.class.split(' ');
  el.classList.add(...classes);

  el.innerText = itemData.emoji;

  // Vị trí ngẫu nhiên
  const maxLeft = container.offsetWidth - 50;
  el.style.left = Math.random() * maxLeft + 'px';

  // Lưu data vào element để xử lý
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

  // Vị trí độ cao ngẫu nhiên
  const topPos = 50 + Math.random() * 200; // Bay ở nửa trên
  bird.style.top = `${topPos}px`;

  // Animation bay (CSS)
  // Random thời gian bay để trông tự nhiên (4s - 8s)
  const duration = 4 + Math.random() * 4;
  bird.style.animation = `flyRight ${duration}s linear`;

  container.appendChild(bird);

  // Tự xóa chim sau khi bay xong
  setTimeout(() => {
    if (bird.parentNode) bird.remove();
  }, duration * 1000);
}

// --- VÒNG LẶP CHÍNH (UPDATE VỊ TRÍ & VA CHẠM) ---

function gameLoop(time) {
  if (!state.isPlaying) return;

  // Tính Delta Time (để mượt mà trên mọi màn hình)
  const deltaTime = (time - state.lastTime) / 16; // Chuẩn hóa về ~1 frame (60fps)
  state.lastTime = time;

  updateBasketPos();

  // Xử lý các vật phẩm đang rơi
  const fruits = document.querySelectorAll('.fruit');
  const basketRect = basket.getBoundingClientRect();
  const containerHeight = container.offsetHeight;

  fruits.forEach(fruit => {
    let y = parseFloat(fruit.dataset.y);
    const speed = parseFloat(fruit.dataset.speed);

    // Cập nhật vị trí
    y += speed * deltaTime;
    fruit.style.top = `${y}px`;
    fruit.dataset.y = y;

    const fruitRect = fruit.getBoundingClientRect();

    // 1. Kiểm tra Va Chạm Rổ
    if (isColliding(fruitRect, basketRect)) {
      handleCatch(fruit);
      return; // Dừng xử lý quả này
    }

    // 2. Kiểm tra Rơi ra ngoài
    if (y > containerHeight) {
      handleMiss(fruit);
    }
  });

  gameLoopId = requestAnimationFrame(gameLoop);
}

// Hàm kiểm tra va chạm (Đơn giản hóa)
function isColliding(a, b) {
  return !(
    a.bottom < b.top + 20 || // Cho phép rổ ăn sâu một chút (+20)
    a.top > b.bottom ||
    a.right < b.left + 10 ||
    a.left > b.right - 10
  );
}

// --- XỬ LÝ LOGIC GAME ---

function handleCatch(el) {
  const type = el.dataset.type;
  const scoreVal = parseInt(el.dataset.score);

  // Xóa ngay lập tức
  el.remove();

  // Logic điểm & Mạng
  state.score += scoreVal;

  if (type === 'good') {
    setPlayerStatus('happy');
  } else if (type === 'bad') {
    // Đá trừ điểm nhưng không đổi hình player
  } else if (type === 'bomb') {
    setPlayerStatus('hit');
    state.lives--;
  }

  checkGameStatus();
  updateUI();
}

function handleMiss(el) {
  const type = el.dataset.type;
  el.remove();

  if (type === 'good') {
    // Rớt quả tốt -> Mất mạng
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
}

// --- ĐIỀU KHIỂN ĐỘ KHÓ ---

function changeDifficulty() {
  state.difficulty++;
  if (state.difficulty > 3) state.difficulty = 1;

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

  // Cập nhật tốc độ spawn nếu đang chơi
  if (state.isPlaying) startSpawning();
}

// --- SỰ KIỆN ---
btnStart.addEventListener('click', startGame);
btnRestart.addEventListener('click', startGame);
btnDiff.addEventListener('click', changeDifficulty);