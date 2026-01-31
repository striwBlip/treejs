// ============================
// ОСНОВНЫЕ ПЕРЕМЕННЫЕ И НАСТРОЙКИ
// ============================

const counterDOM = document.getElementById('counter');
const endDOM = document.getElementById('end');
const scene = new THREE.Scene();
const distance = 500;

// Камера
const camera = new THREE.OrthographicCamera(
  window.innerWidth / -2,
  window.innerWidth / 2,
  window.innerHeight / 2,
  window.innerHeight / -2,
  0.1,
  10000
);

camera.rotation.x = 50 * Math.PI / 180;
camera.rotation.y = 20 * Math.PI / 180;
camera.rotation.z = 10 * Math.PI / 180;

const initialCameraPositionY = -Math.tan(camera.rotation.x) * distance * 0.8;
const initialCameraPositionX = Math.tan(camera.rotation.y) * Math.sqrt(distance ** 2 + initialCameraPositionY ** 2);

camera.position.y = initialCameraPositionY;
camera.position.x = initialCameraPositionX;
camera.position.z = distance;

// Константы игры
const zoom = 2;
const chickenSize = 15;
const positionWidth = 42;
const columns = 17;
const boardWidth = positionWidth * columns;
const stepTime = 200;
const PW = positionWidth * zoom;
const HALF_BOARD = boardWidth * zoom / 2;

const CHICKEN = {
  BODY: { SIZE: 15, DEPTH: 18 },       // тело кубическое 15x15, глубина 20
  HEAD: { SIZE: 8 },                   // голова чуть меньше тела
  COMB: { WIDTH: 8, HEIGHT: 1.5, DEPTH: 3, X: 0, Y: 1 },  // гребень над головой
  BEAK: { WIDTH: 2, HEIGHT: 8, DEPTH: 2, X: 0, Y: 0 },     // клюв спереди головы
  LEFT_WING: { WIDTH: 8, HEIGHT: 2, DEPTH: 4, X: -8, Y: -2, Z: 10, ROT_Z: 0.3 },
  RIGHT_WING: { WIDTH: 8, HEIGHT: 2, DEPTH: 4, X: 8, Y: -2, Z: 10, ROT_Z: -0.3 },
  TAIL: { WIDTH: 4, HEIGHT: 6, DEPTH: 6, X: 0, Y: -6, Z: 4 }
};

// Переменные состояния игры
let gameOver = false;
let lanes;
let currentLane;
let currentColumn;
let previousTimestamp;
let startMoving;
let moves;
let stepStartTimestamp;
let activeBillboards = [];
let isDemoMode = false;
window.isDemoMode = false

// ПЕРЕМЕННЫЕ ДЛЯ АВТОЗАПУСКА
// ============================

let gameStarted = false;
let autoStartTimer = null;
let autoStartDelay = 5000; // 5 секунд до автозапуска
let autoMoveCount = 0;
let autoMoveInterval = null;
let gameResetPending = false;
let lastMoveTime = 0;
let idleTimeout = 10000;

// ============================
// БРЕНДИРОВАНИЕ TOYOTA
// ============================

const TOYOTA_CONFIG = {
  brandName: "TOYOTA",
  brandColors: {
    primary: "#EB0A1E",    // Красный Toyota
    secondary: "#000000",  // Черный
    accent: "#FFFFFF",     // Белый
    background: "#F0F0F0"  // Светло-серый
  },
  slogan: "УПРАВЛЯЙ\nМЕЧТОЙ",
  models: ["CAMRY", "RAV4", "COROLLA", "HILUX", "PRIUS", "LAND CRUISER"]
};

// ============================
// ТЕКСТУРЫ ДЛЯ ТРАНСПОРТНЫХ СРЕДСТВ
// ============================

function Texture(width, height, rects) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  rects.forEach(rect => {
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  });
  return new THREE.CanvasTexture(canvas);
}

const carFrontTexture = new Texture(40, 80, [{x: 0, y: 10, w: 30, h: 60}]);
const carBackTexture = new Texture(40, 80, [{x: 10, y: 10, w: 30, h: 60}]);
const carRightSideTexture = new Texture(110, 40, [
  {x: 10, y: 0, w: 50, h: 30},
  {x: 70, y: 0, w: 30, h: 30}
]);
const carLeftSideTexture = new Texture(110, 40, [
  {x: 10, y: 10, w: 50, h: 30},
  {x: 70, y: 10, w: 30, h: 30}
]);

const truckFrontTexture = new Texture(30, 30, [{x: 15, y: 0, w: 10, h: 30}]);
const truckRightSideTexture = new Texture(25, 30, [{x: 0, y: 15, w: 10, h: 10}]);
const truckLeftSideTexture = new Texture(25, 30, [{x: 0, y: 5, w: 10, h: 10}]);

// ============================
// ФУНКЦИИ ГЕНЕРАЦИИ ИГРОВОГО ПОЛЯ
// ============================

const generateLanes = () => {
  return [-9, -8, -7, -6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
    .map(index => {
      const lane = new Lane(index);
      lane.mesh.position.y = index * PW;
      scene.add(lane.mesh);
      return lane;
    })
    .filter(lane => lane.index >= 0);
};

const addLane = () => {
  const index = lanes.length;
  const lane = new Lane(index);
  lane.mesh.position.y = index * PW;
  scene.add(lane.mesh);
  lanes.push(lane);
};

// Вспомогательные функции для создания текстур
function createToyotaAdTexture(text, bgColor = "#FFFFFF", textColor = "#000000") {
  const canvas = document.createElement('canvas');
  canvas.width = 200;
  canvas.height = 150;
  const ctx = canvas.getContext('2d');

  // Градиентный фон
  const gradient = ctx.createLinearGradient(0, 0, 200, 150);
  gradient.addColorStop(0, bgColor);
  gradient.addColorStop(1, lightenColor(bgColor, 30));
  
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 200, 150);

  // Брендовая рамка Toyota
  ctx.strokeStyle = TOYOTA_CONFIG.brandColors.primary;
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, 196, 146);
  
  // Внутренняя тонкая рамка
  ctx.strokeStyle = textColor;
  ctx.lineWidth = 1;
  ctx.strokeRect(6, 6, 188, 138);

  // Логотип Toyota вверху
  ctx.fillStyle = textColor;
  ctx.font = 'bold 16px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(TOYOTA_CONFIG.brandName, 100, 30);

  // Текст модели
  ctx.fillStyle = textColor;
  ctx.font = 'bold 20px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const lines = text.split('\n');
  const lineHeight = 24;
  const startY = 75;

  // Тень для текста
  ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
  ctx.shadowBlur = 4;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 2;
  
  lines.forEach((line, index) => {
    ctx.fillText(line, 100, startY + (index * lineHeight));
  });
  
  // Сбрасываем тень
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;

  // Декоративные уголки в стиле Toyota
  ctx.strokeStyle = TOYOTA_CONFIG.brandColors.primary;
  ctx.lineWidth = 2;
  
  // Уголки
  drawCorner(ctx, 10, 10, true, true);
  drawCorner(ctx, 190, 10, false, true);
  drawCorner(ctx, 10, 140, true, false);
  drawCorner(ctx, 190, 140, false, false);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;

  return texture;
}

function drawCorner(ctx, x, y, isLeft, isTop) {
  ctx.beginPath();
  if (isLeft) {
    ctx.moveTo(x, y);
    ctx.lineTo(x + 10, y);
  } else {
    ctx.moveTo(x, y);
    ctx.lineTo(x - 10, y);
  }
  
  if (isTop) {
    ctx.moveTo(x, y);
    ctx.lineTo(x, y + 10);
  } else {
    ctx.moveTo(x, y);
    ctx.lineTo(x, y - 10);
  }
  ctx.stroke();
}

function lightenColor(color, percent) {
  const num = parseInt(color.replace("#", ""), 16);
  const amt = Math.round(2.55 * percent);
  const R = (num >> 16) + amt;
  const G = (num >> 8 & 0x00FF) + amt;
  const B = (num & 0x0000FF) + amt;
  return "#" + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
    (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
    (B < 255 ? B < 1 ? 0 : B : 255)).toString(16).slice(1);
}

// Брендированные рекламные текстуры для Toyota
const adConfigs = [
  { text: "НОВАЯ\nCAMRY", bg: TOYOTA_CONFIG.brandColors.primary, textColor: TOYOTA_CONFIG.brandColors.accent },
  { text: "ВНЕДОРОЖНИК\nRAV4", bg: "#000000", textColor: "#FFFFFF" },
  { text: "СЕМЕЙНАЯ\nCOROLLA", bg: "#1C1C1C", textColor: TOYOTA_CONFIG.brandColors.primary },
  { text: "МОЩНЫЙ\nHILUX", bg: "#333333", textColor: "#FFD700" },
  { text: "ГИБРИД\nPRIUS", bg: "#4CAF50", textColor: "#FFFFFF" },
  { text: "ЛЕГЕНДА\nLAND CRUISER", bg: "#003366", textColor: "#FFFFFF" },
  { text: "ТЕСТ-ДРАЙВ\nБЕСПЛАТНО", bg: TOYOTA_CONFIG.brandColors.primary, textColor: TOYOTA_CONFIG.brandColors.accent },
  { text: "СКИДКА\n-15%", bg: TOYOTA_CONFIG.brandColors.primary, textColor: "#FFD700" },
  { text: TOYOTA_CONFIG.slogan, bg: "#000000", textColor: TOYOTA_CONFIG.brandColors.primary },
  { text: "ГАРАНТИЯ\n5 ЛЕТ", bg: "#003366", textColor: "#FFFFFF" }
];

const adTextures = {};
adConfigs.forEach((config, index) => {
  adTextures[`ad${index}`] = createToyotaAdTexture(config.text, config.bg, config.textColor);
});

// ============================
// СОЗДАНИЕ ОБЪЕКТОВ И ОСВЕЩЕНИЯ
// ============================

let chicken = null; // Будет создан позже

const hemiLight = new THREE.HemisphereLight(0xffffff, 0xffffff, 0.6);
scene.add(hemiLight);

const initialDirLightPositionX = -100;
const initialDirLightPositionY = -100;

const dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
dirLight.position.set(initialDirLightPositionX, initialDirLightPositionY, 200);
dirLight.castShadow = true;
scene.add(dirLight);

dirLight.shadow.mapSize.width = 2048;
dirLight.shadow.mapSize.height = 2048;

const d = 500;
dirLight.shadow.camera.left = -d;
dirLight.shadow.camera.right = d;
dirLight.shadow.camera.top = d;
dirLight.shadow.camera.bottom = -d;

const backLight = new THREE.DirectionalLight(0x000000, 0.4);
backLight.position.set(200, 200, 50);
backLight.castShadow = true;
scene.add(backLight);

// Конфигурация игры
const laneTypes = ['car', 'truck', 'forest'];
const laneSpeeds = [2, 2.5, 3];
// Цвета машин в стиле Toyota
const vechicleColors = [
  0xEB0A1E, // Красный Toyota
  0x000000, // Черный
  0x1C1C1C, // Темно-серый
  0x003366  // Синий (для гибридов)
];
const threeHeights = [20, 45, 60];

// ============================
// ФУНКЦИИ АВТОЗАПУСКА И АВТОМАТИЧЕСКОЙ ИГРЫ
// ============================

function startGame(demo = false) {
  if (gameStarted) return;
  
  // Устанавливаем режим
  isDemoMode = demo;
  window.isDemoMode = demo; // Делаем глобально доступной
  
  gameStarted = true;
  lastMoveTime = Date.now();
  if (startScreen) startScreen.style.display = 'none';
  document.title = `Демо: ${TOYOTA_CONFIG.brandName} Crossing`;
  
  // Очищаем таймер автозапуска, если он был
  if (autoStartTimer) {
    clearTimeout(autoStartTimer);
    autoStartTimer = null;
  }
  
  // Запускаем автоматическое движение ТОЛЬКО в демо-режиме
  if (isDemoMode) {
    startAutoMovement();
  }
  
  console.log('Игра начата. Режим:', isDemoMode ? 'Демо' : 'Ручной');
}

function autoStartGame() {
  if (!gameStarted && !autoStartTimer) {
    console.log('Автозапуск через ' + (autoStartDelay/1000) + ' секунд...');
    
    autoStartTimer = setTimeout(() => {
      if (!gameStarted) {
        console.log('Автоматический запуск игры...');
        
        // Инициализируем игру если нужно
        if (!lanes || !chicken) {
          initaliseValues();
        }
        
        startGame(true); // true = демо-режим
        
        // Имитируем нажатие W для начала движения
        setTimeout(() => {
          simulateKeyPress('w');
        }, 500);
      }
    }, autoStartDelay);
  }
}

function canMoveForward() {
  if (currentLane >= lanes.length - 3) {
    return false; // Достигли конца дороги
  }
  
  const targetLane = lanes[currentLane + 1];
  if (!targetLane) return false;
  
  // Проверяем препятствия на целевой полосе
  if (targetLane.type === 'forest') {
    // Проверяем билборд
    if (targetLane.billboardData && targetLane.billboardData.pillarPosition === currentColumn) {
      return false;
    }
    
    // Проверяем деревья
    if (targetLane.occupiedPositions.has(currentColumn)) {
      return false;
    }
  }
  
  return true;
}

// Функция попытки альтернативного движения
function tryAlternativeMove() {
  const possibleMoves = [];
  
  
  
  // Проверяем можно ли двигаться влево
  if (currentColumn > 0) {
    const currentLaneObj = lanes[currentLane];
    let canMoveLeft = true;
    
    if (currentLaneObj.type === 'forest') {
      const leftColumn = currentColumn - 1;
      if (currentLaneObj.billboardData && currentLaneObj.billboardData.pillarPosition === leftColumn) {
        canMoveLeft = false;
      }
      if (currentLaneObj.occupiedPositions.has(leftColumn)) {
        canMoveLeft = false;
      }
    }
    
    if (canMoveLeft) {
      possibleMoves.push('left');
    }
  }
  
  // Проверяем можно ли двигаться вправо
  if (currentColumn < columns - 1) {
    const currentLaneObj = lanes[currentLane];
    let canMoveRight = true;
    
    if (currentLaneObj.type === 'forest') {
      const rightColumn = currentColumn + 1;
      if (currentLaneObj.billboardData && currentLaneObj.billboardData.pillarPosition === rightColumn) {
        canMoveRight = false;
      }
      if (currentLaneObj.occupiedPositions.has(rightColumn)) {
        canMoveRight = false;
      }
    }
    
    if (canMoveRight) {
      possibleMoves.push('right');
    }
  }
  
  // Если есть возможные движения, выбираем случайное
  if (possibleMoves.length > 0) {
    const randomMove = possibleMoves[Math.floor(Math.random() * possibleMoves.length)];
    let keyToPress;
    
    switch(randomMove) {
      case 'left':
        keyToPress = 'a';
        break;
      case 'right':
        keyToPress = 'd';
        break;
    }
    
    if (keyToPress) {
      simulateKeyPress(keyToPress);
      lastMoveTime = Date.now();
      return true;
    }
  }
  
  // Если совсем некуда двигаться, пробуем подождать
  console.log('Некуда двигаться, жду...');
  return false;
}


function startAutoMovement() {
  if (autoMoveInterval) {
    clearTimeout(autoMoveInterval);
  }
  
  // Если игра не начата, не запускаем автоматическое движение
  if (!gameStarted) {
    console.log('Игра не начата, автоматическое движение не запущено');
    return;
  }
  
  const makeMove = () => {
    if (gameStarted && !gameOver && moves.length === 0) {
      // Проверяем, можно ли двигаться вперед
      if (canMoveForward()) {
        // Автоматически двигаем курицу вперед
        simulateKeyPress('w');
        autoMoveCount++;
        // Обновляем время при автоматическом движении
        lastMoveTime = Date.now();
      } else {
        // Если нельзя вперед, пробуем альтернативные движения
        const moved = tryAlternativeMove();
        if (!moved) {
          // Если не удалось сдвинуться, ждем дольше
          console.log('Не удалось найти возможное движение, жду...');
          // Можно попробовать ждать подольше
          const longerInterval = Math.random() * 2000 + 2000; // 2-4 секунды
          autoMoveInterval = setTimeout(makeMove, longerInterval);
          return;
        }
      }
    }
    
    // Устанавливаем следующий интервал случайно от 1 до 2 секунд
    const nextInterval = Math.random() * 1000 + 1000; // от 1000ms до 2000ms
    autoMoveInterval = setTimeout(makeMove, nextInterval);
  };
  
  // Запускаем первый раз через случайный интервал
  const firstInterval = Math.random() * 1000 + 1000;
  autoMoveInterval = setTimeout(makeMove, firstInterval);
  
  console.log('Автоматическое движение запущено');
}

function simulateKeyPress(key) {
  if (gameOver || moves.length > 0 || !gameStarted) return;
  
  const direction = keyMap[key.toLowerCase()];
  if (direction) {
    console.log('Автоматическое движение: ' + direction);
    move(direction);
  }
}

function checkForCollisionAndRestart() {
  if (gameOver && !gameResetPending) {
    gameResetPending = true;
    
    // В ДЕМО-РЕЖИМЕ показываем заставку, в ОБЫЧНОМ режиме - финальный экран
    if (isDemoMode) {
      // Демо-режим: показываем заставку через 1 секунду
      setTimeout(() => {
        console.log('Столкновение в демо-режиме - показ заставки...');
        resetToStartScreen();
      }, 1000);
    } else {
      // Обычный режим: показываем финальный экран
      console.log('Столкновение - показ финального экрана');
      
      
      // Обновляем данные на финальном экране
      document.getElementById('finalScore').textContent = currentLane;
      const promoCode = `TOYOTA${currentLane.toString().padStart(3, '0')}`;
      document.getElementById('promoCode').textContent = promoCode;
      
      // Показываем финальный экран
      endDOM.classList.add('visible');
      endDOM.style.visibility = 'visible';
      
      // Останавливаем автоматическое движение (если было)
      if (autoMoveInterval) {
        clearTimeout(autoMoveInterval);
        autoMoveInterval = null;
      }
    }
  }
}

// ============================
// ИНИЦИАЛИЗАЦИЯ ИГРЫ
// ============================

const initaliseValues = () => {
  // Удаляем старую курицу, если она есть
  if (chicken) {
    scene.remove(chicken);
  }
  
  // Создаем новую курицу
  chicken = new Chicken();
  scene.add(chicken);
  dirLight.target = chicken;
  
  lanes = generateLanes();
  currentLane = 0;
  currentColumn = Math.floor(columns / 2);
  previousTimestamp = null;
  startMoving = false;
  moves = [];
  stepStartTimestamp = null;
  gameOver = false;
  gameResetPending = false;
  autoMoveCount = 0;

  chicken.position.set(0, 0, 0);

  // ===== ОРИЕНТАЦИЯ КАМЕРЫ =====
  const width = window.innerWidth;
  const height = window.innerHeight;

  camera.position.y = initialCameraPositionY;
  camera.position.x = initialCameraPositionX;

  // Если мобильное устройство и вертикальная ориентация — увеличиваем Z, чтобы весь экран поместился
  if (width < 768 && height > width) { // портрет
    camera.position.z = distance * (width / height); 
  } else {
    camera.position.z = distance;
  }

  dirLight.position.set(initialDirLightPositionX, initialDirLightPositionY, dirLight.position.z);

  counterDOM.innerHTML = currentLane;

  // Брендирование счетчика
  counterDOM.style.color = TOYOTA_CONFIG.brandColors.primary;
  counterDOM.style.fontWeight = 'bold';
  counterDOM.style.fontSize = '24px';
  counterDOM.style.textShadow = '2px 2px 4px rgba(0,0,0,0.5)';

  // Создаем брендированный экран окончания
  createToyotaEndScreen();

  endDOM.classList.remove('visible');
  endDOM.style.visibility = 'hidden';
  lastMoveTime = Date.now();

  // ===== УСТАНОВКА РАЗМЕРА RENDERER =====
  renderer.setSize(width, height);
  camera.left   = -width / 2;
  camera.right  =  width / 2;
  camera.top    =  height / 2;
  camera.bottom = -height / 2;
  camera.updateProjectionMatrix();
};

// ============================
// СОЗДАНИЕ РЕНДЕРЕРА
// ============================

const renderer = new THREE.WebGLRenderer({alpha: true, antialias: true});
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// ============================
// КЛАССЫ ДЛЯ СОЗДАНИЯ ОБЪЕКТОВ
// ============================

function bindRetryButton() {
  const retryBtn = document.getElementById('retry');
  if (!retryBtn) return;

  retryBtn.onclick = () => {
    // Останавливаем автоматическое движение
    if (autoMoveInterval) {
      clearTimeout(autoMoveInterval);
      autoMoveInterval = null;
    }
    
    lanes.forEach(lane => scene.remove(lane.mesh));
    initaliseValues();
    endDOM.classList.remove('visible');
    endDOM.style.visibility = 'hidden';
    
    // Сброс состояния игры
    gameOver = false;
    gameStarted = false;
    gameResetPending = false;
    
    if (isDemoMode) {
      // В демо-режиме показываем стартовый экран
      if (startScreen) startScreen.style.display = 'flex';
      // Запускаем таймер автозапуска
      autoStartGame();
    } else {
      // В обычном режиме показываем стартовый экран
      if (startScreen) startScreen.style.display = 'flex';
      // НЕ запускаем автоматически - ждем действия пользователя
    }
  };
}

function Wheel() {
  const mesh = new THREE.Mesh(
    new THREE.BoxBufferGeometry(12 * zoom, 33 * zoom, 12 * zoom),
    new THREE.MeshLambertMaterial({color: 0x333333})
  );
  mesh.position.z = 6 * zoom;
  return mesh;
}

function Car() {
  const group = new THREE.Group();
  const color = vechicleColors[Math.floor(Math.random() * vechicleColors.length)];

  const base = new THREE.Mesh(
    new THREE.BoxBufferGeometry(60 * zoom, 30 * zoom, 15 * zoom),
    new THREE.MeshPhongMaterial({color: color})
  );
  base.position.z = 12 * zoom;
  base.castShadow = true;
  base.receiveShadow = true;
  group.add(base);

  const cabin = new THREE.Mesh(
    new THREE.BoxBufferGeometry(33 * zoom, 24 * zoom, 12 * zoom),
    [
      new THREE.MeshPhongMaterial({color: 0xcccccc, map: carBackTexture}),
      new THREE.MeshPhongMaterial({color: 0xcccccc, map: carFrontTexture}),
      new THREE.MeshPhongMaterial({color: 0xcccccc, map: carRightSideTexture}),
      new THREE.MeshLambertMaterial({color: 0xcccccc, map: carLeftSideTexture}),
      new THREE.MeshLambertMaterial({color: 0xcccccc}),
      new THREE.MeshPhongMaterial({color: 0xcccccc})
    ]
  );
  cabin.position.x = 6 * zoom;
  cabin.position.z = 25.5 * zoom;
  cabin.castShadow = true;
  cabin.receiveShadow = true;
  group.add(cabin);

  const backWheel = new Wheel();
  backWheel.position.x = -18 * zoom;
  group.add(backWheel);

  const frontWheel = new Wheel();
  frontWheel.position.x = 18 * zoom;
  group.add(frontWheel);

  group.castShadow = true;
  group.receiveShadow = false;
  return group;
}

function Truck() {
  const group = new THREE.Group();
  const color = vechicleColors[Math.floor(Math.random() * vechicleColors.length)];

  const base = new THREE.Mesh(
    new THREE.BoxBufferGeometry(100 * zoom, 25 * zoom, 5 * zoom),
    new THREE.MeshLambertMaterial({color: 0xb4c6fc})
  );
  base.position.z = 10 * zoom;
  group.add(base);

  const container = new THREE.Mesh(
    new THREE.BoxBufferGeometry(75 * zoom, 35 * zoom, 40 * zoom),
    new THREE.MeshLambertMaterial({color: 0xb4c6fc})
  );
  container.position.x = 15 * zoom;
  container.position.z = 30 * zoom;
  container.castShadow = true;
  container.receiveShadow = true;
  group.add(container);

  const cabin = new THREE.Mesh(
    new THREE.BoxBufferGeometry(25 * zoom, 30 * zoom, 30 * zoom),
    [
      new THREE.MeshLambertMaterial({color: color}),
      new THREE.MeshPhongMaterial({color: color, map: truckFrontTexture}),
      new THREE.MeshLambertMaterial({color: color, map: truckRightSideTexture}),
      new THREE.MeshLambertMaterial({color: color, map: truckLeftSideTexture}),
      new THREE.MeshLambertMaterial({color: color}),
      new THREE.MeshPhongMaterial({color: color})
    ]
  );
  cabin.position.x = -40 * zoom;
  cabin.position.z = 20 * zoom;
  cabin.castShadow = true;
  cabin.receiveShadow = true;
  group.add(cabin);

  const backWheel = new Wheel();
  backWheel.position.x = -38 * zoom;
  group.add(backWheel);

  const middleWheel = new Wheel();
  middleWheel.position.x = -10 * zoom;
  group.add(middleWheel);

  const frontWheel = new Wheel();
  frontWheel.position.x = 30 * zoom;
  group.add(frontWheel);

  return group;
}

function Tree() {
  const group = new THREE.Group();

  const trunk = new THREE.Mesh(
    new THREE.BoxBufferGeometry(15 * zoom, 15 * zoom, 20 * zoom),
    new THREE.MeshLambertMaterial({color: 0x4d2926})
  );
  trunk.position.z = 10 * zoom;
  trunk.castShadow = true;
  trunk.receiveShadow = true;
  group.add(trunk);

  const height = threeHeights[Math.floor(Math.random() * threeHeights.length)];

  const leaves = new THREE.Mesh(
    new THREE.BoxBufferGeometry(30 * zoom, 30 * zoom, height * zoom),
    new THREE.MeshPhongMaterial({color: 0x7aa21d})
  );
  leaves.position.z = (height / 2 + 20) * zoom;
  leaves.castShadow = true;
  leaves.receiveShadow = false;
  group.add(leaves);

  return group;
}


function Chicken() {
  const group = new THREE.Group();

  // Тело
  const body = new THREE.Mesh(
    new THREE.BoxBufferGeometry(CHICKEN.BODY.SIZE * zoom, CHICKEN.BODY.SIZE * zoom, CHICKEN.BODY.DEPTH * zoom),
    new THREE.MeshLambertMaterial({ color: 0xffffff })
  );
  body.position.set(0, 0, CHICKEN.BODY.DEPTH / 2 * zoom);
  group.add(body);

  // Голова
  const head = new THREE.Mesh(
    new THREE.BoxBufferGeometry(CHICKEN.HEAD.SIZE * zoom, CHICKEN.HEAD.SIZE * zoom, CHICKEN.HEAD.SIZE * zoom),
    new THREE.MeshPhongMaterial({ color: 0xffffff })
  );
  head.position.set(
    0, // X по центру
    CHICKEN.BODY.SIZE / 4 * zoom + CHICKEN.HEAD.SIZE / 2 * zoom, // чуть выше тела
    body.position.z + CHICKEN.BODY.DEPTH / 2 * zoom + CHICKEN.HEAD.SIZE / 2 * zoom // спереди тела
  );
  group.add(head);

  // Гребень
  const comb = new THREE.Mesh(
    new THREE.BoxBufferGeometry(CHICKEN.COMB.WIDTH * zoom, CHICKEN.COMB.HEIGHT * zoom, CHICKEN.COMB.DEPTH * zoom),
    new THREE.MeshPhongMaterial({ color: 0xf0619a })
  );
  comb.position.set(
    CHICKEN.COMB.X * zoom,
    head.position.y + CHICKEN.HEAD.SIZE / 2 * zoom + CHICKEN.COMB.HEIGHT / 2 * zoom,
    head.position.z
  );
  group.add(comb);

  // Клюв
  const beak = new THREE.Mesh(
    new THREE.BoxBufferGeometry(CHICKEN.BEAK.WIDTH * zoom, CHICKEN.BEAK.HEIGHT * zoom, CHICKEN.BEAK.DEPTH * zoom),
    new THREE.MeshPhongMaterial({ color: 0xFFA500 })
  );
  beak.position.set(
    CHICKEN.BEAK.X * zoom,
    head.position.y,
    head.position.z + CHICKEN.HEAD.SIZE / 2 * zoom + CHICKEN.BEAK.DEPTH / 2 * zoom
  );
  group.add(beak);

  // Левое крыло
  const leftWing = new THREE.Mesh(
    new THREE.BoxBufferGeometry(CHICKEN.LEFT_WING.WIDTH * zoom, CHICKEN.LEFT_WING.HEIGHT * zoom, CHICKEN.LEFT_WING.DEPTH * zoom),
    new THREE.MeshLambertMaterial({ color: 0xffffff })
  );
  leftWing.position.set(CHICKEN.LEFT_WING.X * zoom, CHICKEN.LEFT_WING.Y * zoom, CHICKEN.LEFT_WING.Z * zoom);
  leftWing.rotation.z = CHICKEN.LEFT_WING.ROT_Z;
  group.leftWing = leftWing;
  group.add(leftWing);

  // Правое крыло
  const rightWing = new THREE.Mesh(
    new THREE.BoxBufferGeometry(CHICKEN.RIGHT_WING.WIDTH * zoom, CHICKEN.RIGHT_WING.HEIGHT * zoom, CHICKEN.RIGHT_WING.DEPTH * zoom),
    new THREE.MeshLambertMaterial({ color: 0xffffff })
  );
  rightWing.position.set(CHICKEN.RIGHT_WING.X * zoom, CHICKEN.RIGHT_WING.Y * zoom, CHICKEN.RIGHT_WING.Z * zoom);
  rightWing.rotation.z = CHICKEN.RIGHT_WING.ROT_Z;
  group.rightWing = rightWing;
  group.add(rightWing);

  // Хвост
  const tail = new THREE.Mesh(
    new THREE.BoxBufferGeometry(CHICKEN.TAIL.WIDTH * zoom, CHICKEN.TAIL.HEIGHT * zoom, CHICKEN.TAIL.DEPTH * zoom),
    new THREE.MeshLambertMaterial({ color: 0xffffff })
  );
  tail.position.set(CHICKEN.TAIL.X * zoom, CHICKEN.TAIL.Y * zoom, CHICKEN.TAIL.Z * zoom);
  group.add(tail);

  return group;
}


function Road() {
  const group = new THREE.Group();

  const createPlane = (color) => new THREE.Mesh(
    new THREE.PlaneBufferGeometry(boardWidth * zoom, PW),
    new THREE.MeshLambertMaterial({color: color})
  );

  const road = createPlane(0x454a59);
  road.receiveShadow = true;
  group.add(road);

  const leftSide = createPlane(0x393d49);
  leftSide.position.x = -boardWidth * zoom;
  group.add(leftSide);

  const rightSide = createPlane(0x393d49);
  rightSide.position.x = boardWidth * zoom;
  group.add(rightSide);

  return group;
}

function Grass() {
  const group = new THREE.Group();

  const createPlane = (color) => new THREE.Mesh(
    new THREE.BoxBufferGeometry(boardWidth * zoom, PW, 3 * zoom),
    new THREE.MeshPhongMaterial({color: color})
  );

  const grass = createPlane(0xbaf455);
  grass.receiveShadow = true;
  group.add(grass);

  const leftSide = createPlane(0x99c846);
  leftSide.position.x = -boardWidth * zoom;
  group.add(leftSide);

  const rightSide = createPlane(0x99c846);
  rightSide.position.x = boardWidth * zoom;
  group.add(rightSide);

  group.position.z = 1.5 * zoom;
  return group;
}

function Billboard(messageTexture = null) {
  const group = new THREE.Group();

  const CELL_SIZE = positionWidth * zoom; // одна клетка

  // ===== ОСНОВАНИЕ =====
  const base = new THREE.Mesh(
    new THREE.BoxBufferGeometry(
      (positionWidth * zoom * 0.8), // ширина 0.8
      2 * zoom,                         // высота
      (positionWidth * zoom * 0.8)   // глубина 0.8
    ),
    new THREE.MeshLambertMaterial({ color: 0xffffff })
  );
  base.position.y = 1 * zoom;
  base.receiveShadow = true;
  group.add(base);

  // ===== БОРТИК =====
  const border = new THREE.Mesh(
    new THREE.BoxBufferGeometry(
      ((positionWidth * zoom * 0.92 * 0.8)), // ширина 0.8
      1 * zoom,                                 // высота
      ((positionWidth * zoom * 0.92 * 0.8)) // глубина 0.8
    ),
    new THREE.MeshLambertMaterial({ color: 0x2e5d2e })
  );
  border.position.y = 2.5 * zoom;
  border.receiveShadow = true;
  group.add(border);

  // ===== СТОЛБ =====
  const pillar = new THREE.Mesh(
    new THREE.BoxBufferGeometry(3 * zoom, 40 * zoom, 3 * zoom),
    new THREE.MeshLambertMaterial({ color: 0x666666 })
  );
  // Столб в центре основания
  pillar.position.y = 22 * zoom;
  pillar.position.x = 0;
  pillar.position.z = 0;
  pillar.castShadow = true;

  const pillarGroup = new THREE.Group();
  pillarGroup.add(pillar);
  pillarGroup.name = 'pillar';
  group.add(pillarGroup);

  // ===== МАТЕРИАЛ ЩИТА =====
  const boardMaterial = new THREE.MeshPhongMaterial({
    color: 0xffffff,
    map: messageTexture || null
  });
  if (messageTexture) messageTexture.needsUpdate = true;

  // ===== ЩИТ =====
  const board = new THREE.Mesh(
    new THREE.BoxBufferGeometry(50 * zoom, 30 * zoom, 2 * zoom),
    boardMaterial
  );
  board.name = 'board';
  board.rotation.y = Math.PI / 2;
  board.position.y = 57 * zoom; // выше столба
  board.position.z = 0;         // по центру столба
  board.castShadow = true;
  board.receiveShadow = true;
  group.add(board);

  // ===== ОПОРНАЯ БАЛКА =====
  const support = new THREE.Mesh(
    new THREE.BoxBufferGeometry(3 * zoom, 3 * zoom, 50 * zoom),
    new THREE.MeshLambertMaterial({ color: 0x666666 })
  );
  support.position.y = 40 * zoom;
  support.position.z = 0;
  group.add(support);

  // ===== ПОВОРОТ ВСЕЙ КОНСТРУКЦИИ =====
  group.rotation.y = Math.PI / 2;
  group.rotation.z = Math.PI / 2;

  return group;
}

function Lane(index) {
  this.index = index;
  this.type = index <= 0 ? 'field' : laneTypes[Math.floor(Math.random() * laneTypes.length)];

  this.billboard = null;

  switch(this.type) {
    case 'field':
      this.type = 'field';
      this.mesh = new Grass();
      break;

    case 'forest':
      this.mesh = new Grass();
      this.occupiedPositions = new Set();
      this.trees = [];
      this.billboardData = null; // Добавляем для хранения данных о билборде

      // Решаем, будет ли рекламный щит (30% шанс)
      const hasBillboard = Math.random() < 0.3 && index > 2;
      let billboardPosition = null;

      if (hasBillboard) {
        // Выбираем позицию для щита
        billboardPosition = Math.floor(Math.random() * columns);
        
        // Занята только позиция СТОЛБА (не весь билборд)
        this.occupiedPositions.add(billboardPosition);
        if (billboardPosition > 0) {
          this.occupiedPositions.add(billboardPosition - 1);
        }
        if (billboardPosition < columns - 1) {
          this.occupiedPositions.add(billboardPosition + 1);
        }

        // Создаем щит
        const billboard = new Billboard();
        
        // Сохраняем данные о билборде
        this.billboardData = {
          position: billboardPosition,
          pillarPosition: billboardPosition, // Столб занимает эту позицию
          boardWidth: 50, // Ширина щита в единицах zoom
          canPassUnder: true // Под щитом можно пройти
        };

        // Выбираем случайную рекламную текстуру
        const adKeys = Object.keys(adTextures);
        const randomAd = adKeys[Math.floor(Math.random() * adKeys.length)];

        // Применяем текстуру к щиту (board - второй элемент после pillar)
        const boardMesh = billboard.getObjectByName('board'); // Щит
        
        if (boardMesh) {
          boardMesh.material = new THREE.MeshPhongMaterial({
            map: adTextures[randomAd],
            side: THREE.DoubleSide
          });
        }

        billboard.position.x = (billboardPosition * positionWidth + positionWidth / 2) * zoom - HALF_BOARD;
        billboard.position.y = 0;

        this.mesh.add(billboard);
        this.billboard = billboard;
        this.trees.push(billboard);
        

      }

      // Создаем деревья (деревья мешают везде)
      const treesNeeded = hasBillboard ? 3 : 4;
      
      for (let i = 0; i < treesNeeded; i++) {
        let position;
        let attempts = 0;
        const maxAttempts = 100;

        do {
          position = Math.floor(Math.random() * columns);
          attempts++;
          if (attempts > maxAttempts) {
            // Ищем первую свободную позицию
            for (let j = 0; j < columns; j++) {
              if (!this.occupiedPositions.has(j)) {
                position = j;
                break;
              }
            }
            break;
          }
        } while(this.occupiedPositions.has(position));

        this.occupiedPositions.add(position);
        
        const tree = new Tree();
        tree.position.x = (position * positionWidth + positionWidth / 2) * zoom - HALF_BOARD;
        this.mesh.add(tree);
        this.trees.push(tree);
      }
      
      break;

    case 'car':
      this.mesh = new Road();
      this.direction = Math.random() >= 0.5;
      const carPositions = new Set();
      
      // Определяем количество машин в зависимости от режима
      let carCountArray;
      if (isDemoMode) {
        carCountArray = [1]; // Мало машин в демо-режиме
      } else {
        carCountArray = [1, 2, 3]; // Больше машин в обычном режиме
      }
      
      this.vechicles = carCountArray.map(() => {
        const car = new Car();
        let position;
        do {
          position = Math.floor(Math.random() * columns / 2);
        } while(carPositions.has(position));

        carPositions.add(position);
        car.position.x = (position * positionWidth * 2 + positionWidth / 2) * zoom - HALF_BOARD;

        if(!this.direction) car.rotation.z = Math.PI;
        this.mesh.add(car);
        return car;
      });
      this.speed = laneSpeeds[Math.floor(Math.random() * laneSpeeds.length)];
      break;

    case 'truck':
      this.mesh = new Road();
      this.direction = Math.random() >= 0.5;
      const truckPositions = new Set();
      
      // Определяем количество грузовиков в зависимости от режима
      let truckCountArray;
      if (isDemoMode) {
        truckCountArray = [1]; // 1 грузовик в демо-режиме
      } else {
        truckCountArray = [1, 2]; // 2 грузовика в обычном режиме
      }
      
      this.vechicles = truckCountArray.map(() => {
        const truck = new Truck();
        let position;
        do {
          position = Math.floor(Math.random() * columns / 3);
        } while(truckPositions.has(position));

        truckPositions.add(position);
        truck.position.x = (position * positionWidth * 3 + positionWidth / 2) * zoom - HALF_BOARD;

        if(!this.direction) truck.rotation.z = Math.PI;
        this.mesh.add(truck);
        return truck;
      });
      this.speed = laneSpeeds[Math.floor(Math.random() * laneSpeeds.length)];
      break;
  }
}

// ============================
// БРЕНДИРОВАННЫЙ ИНТЕРФЕЙС
// ============================

function createToyotaEndScreen() {
  endDOM.innerHTML = `
    <div class="end-content" style="
      background: linear-gradient(135deg, ${TOYOTA_CONFIG.brandColors.secondary}, ${TOYOTA_CONFIG.brandColors.primary});
      border: 4px solid ${TOYOTA_CONFIG.brandColors.accent};
      color: ${TOYOTA_CONFIG.brandColors.accent};
      padding: 20px;
      border-radius: 15px;
      text-align: center;
      max-width: 90%;
      margin: 0 auto;
      box-shadow: 0 10px 30px rgba(0,0,0,0.5);
      overflow-y: auto;
      max-height: 85vh;
      font-size: 14px;
    ">
      <div style="font-size: 24px; margin-bottom: 8px; color: #FFD700;">🏆</div>
      <h2 style="font-size: 20px; margin-bottom: 15px; text-transform: uppercase;">
        Ваш результат: <span id="finalScore">0</span>
      </h2>
      
      <div style="
        background: rgba(255,255,255,0.1);
        padding: 15px;
        border-radius: 8px;
        margin-bottom: 20px;
        border-left: 3px solid ${TOYOTA_CONFIG.brandColors.accent};
      ">
        <div style="font-size: 18px; margin-bottom: 8px; font-weight: bold;">
          ${TOYOTA_CONFIG.brandName}
        </div>
        <div style="font-size: 14px; margin-bottom: 8px; font-style: italic;">
          ${TOYOTA_CONFIG.slogan}
        </div>
        <div style="font-size: 12px; opacity: 0.9;">
          Автосалон премиум-класса
        </div>
      </div>
      
      <div style="margin-bottom: 20px; text-align: left; background: rgba(0,0,0,0.3); padding: 12px; border-radius: 6px; font-size: 12px;">
        <div style="margin-bottom: 8px; font-weight: bold;">Контакты:</div>
        <div style="margin-bottom: 4px;">📍 г. Москва, ул. Автомобильная, 1</div>
        <div style="margin-bottom: 4px;">📞 +7 (495) 123-45-67</div>
        <div style="margin-bottom: 4px;">🌐 www.toyota-demo.ru</div>
        <div>🕒 Ежедневно 9:00 - 21:00</div>
      </div>
      
      <div style="margin-bottom: 20px; font-size: 14px;">
        Приходите на тест-драйв и получите<br>
        <span style="color: #FFD700; font-weight: bold;">специальный подарок</span> по промокоду:<br>
        <div style="
          background: ${TOYOTA_CONFIG.brandColors.accent};
          color: ${TOYOTA_CONFIG.brandColors.primary};
          padding: 8px 15px;
          border-radius: 5px;
          font-family: monospace;
          font-size: 16px;
          font-weight: bold;
          margin: 10px auto;
          display: inline-block;
          letter-spacing: 1px;
          border: 2px solid ${TOYOTA_CONFIG.brandColors.primary};
          word-break: break-all;
          max-width: 100%;
        " id="promoCode">
          TOYOTA000
        </div>
      </div>
      
      <button id="retry" style="
        background: ${TOYOTA_CONFIG.brandColors.accent};
        color: ${TOYOTA_CONFIG.brandColors.primary};
        border: 2px solid ${TOYOTA_CONFIG.brandColors.primary};
        padding: 12px 30px;
        font-size: 16px;
        border-radius: 8px;
        cursor: pointer;
        font-weight: bold;
        transition: all 0.3s;
        margin-bottom: 10px;
        width: 100%;
        max-width: 250px;
      " onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
        ИГРАТЬ СНОВА
      </button>
      
      <div style="font-size: 10px; opacity: 0.7; margin-top: 15px; line-height: 1.4;">
        Демо-версия игры разработана игровой студией<br>
        <span style="font-weight: bold;">GameDev Studio</span> для автосалона ${TOYOTA_CONFIG.brandName}
      </div>
    </div>
  `;
  bindRetryButton();
}

// ============================
// ОБРАБОТЧИКИ СОБЫТИЙ
// ============================

const keyMap = {
  // Вперед
  'w': 'forward',
  'ц': 'forward', // Русская W
  'arrowup': 'forward',
  '38': 'forward', // keyCode
  // Назад
  's': 'backward',
  'ы': 'backward', // Русская S
  'arrowdown': 'backward',
  '40': 'backward',
  // Влево
  'a': 'left',
  'ф': 'left', // Русская A
  'arrowleft': 'left',
  '37': 'left',
  // Вправо
  'd': 'right',
  'в': 'right', // Русская D
  'arrowright': 'right',
  '39': 'right'
};

// ============================
// ЛОГИКА ДВИЖЕНИЯ КУРИЦЫ
// ============================

function move(direction) {
  // Блокируем управление если игра окончена
  if (gameOver) {
    return;
  }
  lastMoveTime = Date.now();

  const newPosition = moves.reduce((pos, moveDir) => {
    if(moveDir === 'forward') return {lane: pos.lane + 1, column: pos.column};
    if(moveDir === 'backward') return {lane: pos.lane - 1, column: pos.column};
    if(moveDir === 'left') return {lane: pos.lane, column: pos.column - 1};
    if(moveDir === 'right') return {lane: pos.lane, column: pos.column + 1};
  }, {lane: currentLane, column: currentColumn});

  // Проверка препятствий
  if(direction === 'forward') {
    const targetLane = lanes[newPosition.lane + 1];
    if(!targetLane) return;
    
    if(targetLane.type === 'forest') {
      // Проверяем, есть ли билборд на целевой позиции
      if(targetLane.billboardData && targetLane.billboardData.pillarPosition === newPosition.column) {
        console.log('Не могу двигаться вперед - билборд');
        return;
      }
      
      // Проверяем обычные деревья
      if(targetLane.occupiedPositions.has(newPosition.column)) {
        console.log('Не могу двигаться вперед - дерево');
        return;
      }
    }
    if(!stepStartTimestamp) startMoving = true;
    addLane();
    
  } else if(direction === 'backward') {
    if(newPosition.lane === 0) return;
    const targetLane = lanes[newPosition.lane - 1];
    
    if(targetLane.type === 'forest') {
      // Проверяем билборд
      if(targetLane.billboardData && targetLane.billboardData.pillarPosition === newPosition.column) {
        console.log('Не могу двигаться назад - билборд');
        return;
      }
      
      if(targetLane.occupiedPositions.has(newPosition.column)) {
        console.log('Не могу двигаться назад - дерево');
        return;
      }
    }
    if(!stepStartTimestamp) startMoving = true;
    
  } else if(direction === 'left') {
    if(newPosition.column === 0) return;
    const currentLaneObj = lanes[newPosition.lane];
    
    if(currentLaneObj.type === 'forest') {
      // Для движения влево проверяем позицию слева
      const leftColumn = newPosition.column - 1;
      
      // Проверяем билборд
      if(currentLaneObj.billboardData && currentLaneObj.billboardData.pillarPosition === leftColumn) {
        console.log('Не могу двигаться влево - билборд');
        return;
      }
      
      if(currentLaneObj.occupiedPositions.has(leftColumn)) {
        console.log('Не могу двигаться влево - дерево');
        return;
      }
    }
    if(!stepStartTimestamp) startMoving = true;
    
  } else if(direction === 'right') {
    if(newPosition.column === columns - 1) return;
    const currentLaneObj = lanes[newPosition.lane];
    
    if(currentLaneObj.type === 'forest') {
      // Для движения вправо проверяем позицию справа
      const rightColumn = newPosition.column + 1;
      
      // Проверяем билборд
      if(currentLaneObj.billboardData && currentLaneObj.billboardData.pillarPosition === rightColumn) {
        console.log('Не могу двигаться вправо - билборд');
        return;
      }
      
      if(currentLaneObj.occupiedPositions.has(rightColumn)) {
        console.log('Не могу двигаться вправо - дерево');
        return;
      }
    }
    if(!stepStartTimestamp) startMoving = true;
  }

  moves.push(direction);
  console.log('Движение: ' + direction + ', moves: ' + moves.length);
}

// ============================
// ГЛАВНЫЙ ЦИКЛ АНИМАЦИИ
// ============================

function resetToStartScreen() {
  console.log('Возврат к заставке. Причина:', 
    gameOver ? 'Столкновение' : 
    'Бездействие (' + (idleTimeout/1000) + ' секунд)');
  
  // Останавливаем все таймеры и интервалы
  if (autoMoveInterval) {
    clearTimeout(autoMoveInterval);
    autoMoveInterval = null;
  }
  
  if (autoStartTimer) {
    clearTimeout(autoStartTimer);
    autoStartTimer = null;
  }
  
  // Сбрасываем состояние
  gameOver = false;
  gameStarted = false;
  gameResetPending = false;
  moves = [];
  stepStartTimestamp = null;
  startMoving = false;
  
  // Скрываем финальный экран (если он был показан)
  endDOM.classList.remove('visible');
  endDOM.style.visibility = 'hidden';
  
  // Очищаем сцену
  if (lanes) {
    lanes.forEach(lane => scene.remove(lane.mesh));
  }
  
  // Переинициализируем игру
  initaliseValues();
  
  // Показываем стартовый экран
  if (startScreen) startScreen.style.display = 'flex';
  
  // Если был демо-режим, запускаем таймер автозапуска
  if (isDemoMode) {
    autoStartGame();
  }
  // Сбрасываем режим ТОЛЬКО если причина - бездействие
  if (!gameOver) {
    isDemoMode = false;
    window.isDemoMode = false;
  }
}

function animate(timestamp) {
  requestAnimationFrame(animate);
  if (!lanes || !chicken) {
    renderer.render(scene, camera);
    return;
  }

  if (gameOver) {
    renderer.render(scene, camera);
    return;
  }

  if (gameStarted && !gameOver && moves.length === 0 && !stepStartTimestamp && isDemoMode) {
    const currentTime = Date.now();
    
    // Проверяем время без движения, но только если курица действительно стоит
    // (stepStartTimestamp отсутствует, moves пустой)
    if (currentTime - lastMoveTime > idleTimeout) {
      console.log('Бездействие более ' + (idleTimeout/1000) + ' секунд - показ заставки');
      resetToStartScreen();
      return;
    }
  }

  if(!previousTimestamp) previousTimestamp = timestamp;
  const deltaTime = timestamp - previousTimestamp;
  previousTimestamp = timestamp;

  // Движение транспорта
  lanes.forEach(lane => {
    if(lane.type === 'car' || lane.type === 'truck') {
      const carWidth = lane.type === 'car' ? 60 * zoom : 105 * zoom;
      const extraMargin = carWidth * 2;
      
      const leftBound = -HALF_BOARD - extraMargin;
      const rightBound = HALF_BOARD + extraMargin;

      lane.vechicles.forEach(vehicle => {
        if(lane.direction) {
          vehicle.position.x = vehicle.position.x < leftBound ?
            rightBound :
            vehicle.position.x - lane.speed / 10 * deltaTime;
        } else {
          vehicle.position.x = vehicle.position.x > rightBound ?
            leftBound :
            vehicle.position.x + lane.speed / 10 * deltaTime;
        }
      });
    }
  });

  if(startMoving) {
    stepStartTimestamp = timestamp;
    startMoving = false;
  }

  if(stepStartTimestamp) {
    const elapsed = timestamp - stepStartTimestamp;
    const progress = Math.min(elapsed / stepTime, 1) * PW;
    const jumpHeight = Math.sin(Math.pow(elapsed / stepTime, 0.1) * Math.PI) * 8 * zoom;

    // Анимация крыльев
    const flapSpeed = 0.1; // скорость взмахов
    const flapAmplitude = 0.8; // амплитуда взмахов (больше = сильнее)
    const flapOffset = Math.sin(elapsed * flapSpeed) * flapAmplitude;

    if (jumpHeight > 2) {
      chicken.leftWing.rotation.z = 0.3 + flapOffset;
      chicken.rightWing.rotation.z = -0.3 - flapOffset;
    } else {
      chicken.leftWing.rotation.z = 0.3 + flapOffset * 0.5;
      chicken.rightWing.rotation.z = -0.3 - flapOffset * 0.5;
    }

    switch(moves[0]) {
      case 'forward':
        const forwardY = currentLane * PW + progress;
        camera.position.y = initialCameraPositionY + forwardY;
        dirLight.position.y = initialDirLightPositionY + forwardY;
        chicken.position.y = forwardY;
        chicken.position.z = jumpHeight;
        break;

      case 'backward':
        const backwardY = currentLane * PW - progress;
        camera.position.y = initialCameraPositionY + backwardY;
        dirLight.position.y = initialDirLightPositionY + backwardY;
        chicken.position.y = backwardY;
        chicken.position.z = jumpHeight;
        break;

      case 'left':
        const leftX = (currentColumn * positionWidth + positionWidth / 2) * zoom - HALF_BOARD - progress;
        camera.position.x = initialCameraPositionX + leftX;
        dirLight.position.x = initialDirLightPositionX + leftX;
        chicken.position.x = leftX;
        chicken.position.z = jumpHeight;
        break;

      case 'right':
        const rightX = (currentColumn * positionWidth + positionWidth / 2) * zoom - HALF_BOARD + progress;
        camera.position.x = initialCameraPositionX + rightX;
        dirLight.position.x = initialDirLightPositionX + rightX;
        chicken.position.x = rightX;
        chicken.position.z = jumpHeight;
        break;
    }

    if(elapsed > stepTime) {
      switch(moves[0]) {
        case 'forward':
          currentLane++;
          counterDOM.innerHTML = currentLane;
          break;
        case 'backward':
          currentLane--;
          counterDOM.innerHTML = currentLane;
          break;
        case 'left':
          currentColumn--;
          break;
        case 'right':
          currentColumn++;
          break;
      }
      moves.shift();
      stepStartTimestamp = moves.length === 0 ? null : timestamp;
    }
  }

  // ПРОВЕРКА СТОЛКНОВЕНИЙ С МАШИНАМИ
  if(lanes[currentLane] && (lanes[currentLane].type === 'car' || lanes[currentLane].type === 'truck')) {
    const chickenX = chicken.position.x;
    const chickenZ = chicken.position.z;
    const chickenHalfWidth = chickenSize * zoom / 2;
    const chickenHalfDepth = 10 * zoom;

    const vehicleType = lanes[currentLane].type;
    const vehicleWidth = {'car': 60, 'truck': 105}[vehicleType];
    const vehicleDepth = {'car': 15, 'truck': 40}[vehicleType];

    lanes[currentLane].vechicles.forEach(vehicle => {
      const vehicleX = vehicle.position.x;
      const vehicleZ = vehicle.position.z;
      const vehicleHalfWidth = vehicleWidth * zoom / 2;
      const vehicleHalfDepth = vehicleDepth * zoom / 2;

      const collisionX = Math.abs(chickenX - vehicleX) < (chickenHalfWidth + vehicleHalfWidth);
      const collisionZ = Math.abs(chickenZ - vehicleZ) < (chickenHalfDepth + vehicleHalfDepth);

      if (collisionX && collisionZ) {
        gameOver = true;
        
        // Останавливаем автоматическое движение
        if (autoMoveInterval) {
          clearTimeout(autoMoveInterval); 
          autoMoveInterval = null;
        }
        
        // // Обновляем финальный экран
        // document.getElementById('finalScore').textContent = currentLane;
        // const promoCode = `TOYOTA${currentLane.toString().padStart(3, '0')}`;
        // document.getElementById('promoCode').textContent = promoCode;
        
        // endDOM.classList.add('visible');
        // endDOM.style.visibility = 'visible';

        moves = [];
        stepStartTimestamp = null;
        startMoving = false;
        
        // Запускаем проверку для автоматического перезапуска
        checkForCollisionAndRestart();
      }
    });
  }
  
  renderer.render(scene, camera);
}

// Адаптация к размеру окна
window.addEventListener('resize', () => {
  camera.left = window.innerWidth / -2;
  camera.right = window.innerWidth / 2;
  camera.top = window.innerHeight / 2;
  camera.bottom = window.innerHeight / -2;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Добавляем стартовый экран Toyota
const startScreen = document.createElement('div');
startScreen.id = 'startScreen';
startScreen.style.cssText = `
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, ${TOYOTA_CONFIG.brandColors.secondary}, ${TOYOTA_CONFIG.brandColors.primary});
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  color: ${TOYOTA_CONFIG.brandColors.accent};
  font-family: Arial, sans-serif;
`;

startScreen.innerHTML = `
  <div style="text-align: center; max-width: 600px; padding: 40px;">
    <h1 style="font-size: 48px; margin-bottom: 20px; text-shadow: 3px 3px 6px rgba(0,0,0,0.5);">
      ${TOYOTA_CONFIG.brandName} CROSSING
    </h1>
    <div style="font-size: 24px; margin-bottom: 30px; font-style: italic;">
      ${TOYOTA_CONFIG.slogan}
    </div>
    <div style="background: rgba(255,255,255,0.1); padding: 20px; border-radius: 10px; margin-bottom: 30px;">
      <h2 style="margin-bottom: 15px;">ДЕМО-ВЕРСИЯ ИГРЫ</h2>
      <p style="margin-bottom: 10px;">Разработано для автосалона ${TOYOTA_CONFIG.brandName}</p>
      <p>Демонстрация возможностей игровой студии</p>
    </div>
    <button id="startGame" style="
      background: ${TOYOTA_CONFIG.brandColors.accent};
      color: ${TOYOTA_CONFIG.brandColors.primary};
      border: none;
      padding: 15px 40px;
      font-size: 20px;
      border-radius: 8px;
      cursor: pointer;
      font-weight: bold;
      transition: all 0.3s;
      margin-bottom: 20px;
    " onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
      НАЧАТЬ ИГРУ
    </button>
    <div style="font-size: 14px; opacity: 0.8;">
      Управление: WASD или стрелки ←↑→↓
    </div>
    <div style="margin-top: 30px; font-size: 12px; opacity: 0.6;">
      © Демонстрация разработки игр. Все бренды принадлежат их владельцам.
    </div>
  </div>
`;

document.body.appendChild(startScreen);

// Обработчик старта игры
document.getElementById('startGame').addEventListener('click', () => {
  startGame(false); // false = не демо-режим
});

// Клик по окну рендерера для запуска игры
renderer.domElement.addEventListener('click', () => {
  if (!gameStarted && startScreen.style.display !== 'none') {
    startGame(false);
  }
});

// Клик по стартовому экрану в любом месте
startScreen.addEventListener('click', (e) => {
  // Проверяем, что клик не по кнопке Start (она обрабатывается отдельно)
  if (e.target.id !== 'startGame' && !e.target.closest('#startGame')) {
    startGame(false);
  }
});

// Обработчики кнопок управления
if (document.getElementById('forward')) {
  document.getElementById('forward').addEventListener('click', () => move('forward'));
}
if (document.getElementById('backward')) {
  document.getElementById('backward').addEventListener('click', () => move('backward'));
}
if (document.getElementById('left')) {
  document.getElementById('left').addEventListener('click', () => move('left'));
}
if (document.getElementById('right')) {
  document.getElementById('right').addEventListener('click', () => move('right'));
}

// Обработчик клавиатуры
window.addEventListener('keydown', event => {
  const key = event.key.toLowerCase();
  const keyCode = event.keyCode.toString();
  
  // Проверяем все возможные варианты
  if (keyMap[key] || keyMap[keyCode]) {
    const direction = keyMap[key] || keyMap[keyCode];
    move(direction);
    event.preventDefault(); // Предотвращаем стандартное поведение
  }
});

// Слушатель изменения размера окна
window.addEventListener('resize', () => {
  const width = window.innerWidth;
  const height = window.innerHeight;
  renderer.setSize(width, height);
  camera.left   = -width / 2;
  camera.right  =  width / 2;
  camera.top    =  height / 2;
  camera.bottom = -height / 2;
  camera.updateProjectionMatrix();
});

// Запуск игры после инициализации
setTimeout(() => {
  initaliseValues();
  
  // Показываем стартовый экран
  if (startScreen) startScreen.style.display = 'flex';
  
  // Запускаем таймер автозапуска
  setTimeout(() => {
    autoStartGame();
  }, 1000);
  
  requestAnimationFrame(animate);
}, 100);

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.attributeName === 'style') {
        const displayStyle = startScreen.style.display;
        if (displayStyle !== 'none' && !gameStarted) {
          autoStartGame();
        }
      }
    });
  });
  
  observer.observe(startScreen, { attributes: true });
});
