/**
 * Kozminski Escape: Polowanie na ECTS
 * js/game.js - Główny silnik gry 2D
 * Akademia Leona Koźmińskiego (ALK) w Warszawie
 */

(function () {
  'use strict';

  // ==========================================
  // ELEMENTY DOM & KONFIGURACJA
  // ==========================================
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');

  // Elementy HUD
  const ectsCounter = document.getElementById('ectsCounter');
  const currentEctsSpan = document.getElementById('currentEcts');
  const ectsProgressBar = document.getElementById('ectsProgressBar');
  const staminaValue = document.getElementById('staminaValue');
  const staminaProgressBar = document.getElementById('staminaProgressBar');
  const campusLocation = document.getElementById('campusLocation');
  const dangerStatus = document.getElementById('dangerStatus');
  const dangerText = document.getElementById('dangerText');
  const soundToggleBtn = document.getElementById('soundToggleBtn');
  const soundIcon = document.getElementById('soundIcon');
  const pauseToggleBtn = document.getElementById('pauseToggleBtn');
  const pauseIcon = document.getElementById('pauseIcon');
  const artilleryBtn = document.getElementById('artilleryBtn');
  const artilleryHudTimer = document.getElementById('artilleryHudTimer');

  // Dymek profesora & nakładki
  const professorBubble = document.getElementById('professorBubble');
  const bubbleQuoteText = document.getElementById('bubbleQuoteText');
  const screenVignette = document.getElementById('screenVignette');
  const powerupToast = document.getElementById('powerupToast');

  // Ekrany modalne
  const startModal = document.getElementById('startModal');
  const gameOverModal = document.getElementById('gameOverModal');
  const victoryModal = document.getElementById('victoryModal');
  const startGameBtn = document.getElementById('startGameBtn');
  const restartGameBtn = document.getElementById('restartGameBtn');
  const playAgainBtn = document.getElementById('playAgainBtn');

  // Statystyki końcowe
  const finalFailedEcts = document.getElementById('finalFailedEcts');
  const finalSurvivalTime = document.getElementById('finalSurvivalTime');
  const finalCoffeesDrunk = document.getElementById('finalCoffeesDrunk');
  const victoryEcts = document.getElementById('victoryEcts');
  const victoryTime = document.getElementById('victoryTime');
  const victoryScore = document.getElementById('victoryScore');

  // Przyciski dotykowe (mobilne)
  const touchUp = document.getElementById('touchUp');
  const touchDown = document.getElementById('touchDown');
  const touchLeft = document.getElementById('touchLeft');
  const touchRight = document.getElementById('touchRight');
  const touchSprintBtn = document.getElementById('touchSprintBtn');
  const touchArtilleryBtn = document.getElementById('touchArtilleryBtn');
  const touchArtilleryText = document.getElementById('touchArtilleryText');
  const touchPauseBtn = document.getElementById('touchPauseBtn');

  // ==========================================
  // STAŁE I PARAMETRY GRY
  // ==========================================
  const CANVAS_WIDTH = 800;
  const CANVAS_HEIGHT = 540;
  const TARGET_ECTS = 30;

  // Parametry Artylerii (wezwanie wykładowcy do kąta raz na 2 minuty)
  const ARTILLERY_COOLDOWN = 120; // 2 minuty (120 sekund)
  const CORNER_DURATION = 10;     // Czas spędzony przez profesora w kącie (10 sekund)
  const CORNER_POS = { x: 55, y: 485 }; // Karny Kąt Dziekana w Budynku D

  // Cytaty Egzaminatora (prof. Nowakowskiego)
  const PROFESSOR_QUOTES = [
    "Nie ma litości na zerówce! Gdzie pan biegnie?!",
    "Pana podanie o warunek nie zostało nawet otwarte!",
    "Termin oddania pracy licencjackiej minął o 12:00!",
    "Widzę pana za tą palmą na Patio ALK!",
    "Format APA 7th edition, panie kolego! Gdzie są przypisy?!",
    "Czy pan w ogóle przeczytał sylabus tego przedmiotu?!",
    "Do dziekanatu z takim podejściem pan nie wejdzie!",
    "Do września jeszcze daleko, ale ja już szykuję test!"
  ];

  // Komiczne cytaty, gdy profesor zostaje odesłany artylerią do kąta
  const CORNER_QUOTES = [
    "Co?! Pismo z Dziekanatu nakazuje mi natychmiast stać w kącie?!",
    "Kto wezwał na mnie artylerię?! Ja tu tylko egzekwuję sylabus!",
    "Moja godność profesora została zdeptana... Jeszcze tu wrócę!",
    "Postoję te 10 sekund w kącie, ale ECTS-ów i tak wam nie daruję!",
    "To zamach na autonomię uczelni! Jak skończy się kara w kącie, wracam!",
    "Karny kąt?! Przecież ja mam tytuł profesora belwederskiego!"
  ];

  // ==========================================
  // STAN GRY (STATE MACHINE)
  // ==========================================
  const GameState = {
    MENU: 'MENU',
    PLAYING: 'PLAYING',
    PAUSED: 'PAUSED',
    GAME_OVER: 'GAME_OVER',
    VICTORY: 'VICTORY'
  };

  let currentState = GameState.MENU;
  let animationFrameId = null;
  let lastTimestamp = 0;
  let gameTime = 0; // w sekundach
  let coffeesDrunk = 0;
  let bubbleTimeout = null;
  let toastTimeout = null;

  // Zmienne systemowe Artylerii
  let artilleryTimer = 0; // 0 = natychmiast gotowa do użycia!
  let screenShakeTime = 0;
  let artilleryImpactAnim = null;

  // Sterowanie (klawisze)
  const keys = {
    up: false,
    down: false,
    left: false,
    right: false,
    sprint: false
  };

  // ==========================================
  // UKŁAD KAMPUSU ALK (ŚCIANY I OBIEKTY)
  // ==========================================
  // Strefy:
  // - Korytarz i Aule Budynku D: lewa strona (x: 0 - 280)
  // - Zielone Patio ALK ze szklanym dachem i palmami: środek (x: 280 - 540)
  // - Biblioteka i Aula Główna: prawa strona (x: 540 - 800)
  const campusObstacles = [
    // Granice zewnętrzne (ściany kampusu)
    { x: 0, y: 0, w: CANVAS_WIDTH, h: 16, type: 'wall' },
    { x: 0, y: CANVAS_HEIGHT - 16, w: CANVAS_WIDTH, h: 16, type: 'wall' },
    { x: 0, y: 0, w: 16, h: CANVAS_HEIGHT, type: 'wall' },
    { x: CANVAS_WIDTH - 16, y: 0, w: 16, h: CANVAS_HEIGHT, type: 'wall' },

    // Ściana działowa Budynku D (z przejściami do Patio)
    { x: 260, y: 16, w: 14, h: 140, type: 'wall' },
    { x: 260, y: 220, w: 14, h: 120, type: 'wall' },
    { x: 260, y: 400, w: 14, h: 124, type: 'wall' },

    // Ściana działowa Biblioteki (z przejściami do Patio)
    { x: 540, y: 16, w: 14, h: 140, type: 'wall' },
    { x: 540, y: 220, w: 14, h: 120, type: 'wall' },
    { x: 540, y: 400, w: 14, h: 124, type: 'wall' },

    // Budynek D - Biurka wykładowe i tablica
    { x: 48, y: 48, w: 160, h: 36, type: 'desk', label: 'AULA D-1' },
    { x: 48, y: 140, w: 140, h: 32, type: 'desk', label: 'Ławki' },
    { x: 48, y: 340, w: 140, h: 32, type: 'desk', label: 'Dziekanat' },
    { x: 48, y: 420, w: 150, h: 36, type: 'desk', label: 'SALA D-5' },

    // Patio ALK - Donice z palmami i roślinnością, ławki, kawiarnia
    { x: 340, y: 80, w: 44, h: 44, type: 'plant', label: 'Fikus' },
    { x: 440, y: 80, w: 44, h: 44, type: 'plant', label: 'Monstera' },
    { x: 370, y: 240, w: 84, h: 64, type: 'cafe', label: 'KAWIARNIA ALK' },
    { x: 340, y: 410, w: 44, h: 44, type: 'plant', label: 'Palma ALK' },
    { x: 440, y: 410, w: 44, h: 44, type: 'plant', label: 'Palma ALK' },

    // Biblioteka ALK - Regały na książki (zarządzanie, finanse, prawo)
    { x: 590, y: 60, w: 160, h: 32, type: 'bookshelf', label: 'Finanse & Rachunkowość' },
    { x: 590, y: 140, w: 160, h: 32, type: 'bookshelf', label: 'Zarządzanie & MBA' },
    { x: 590, y: 340, w: 160, h: 32, type: 'bookshelf', label: 'Prawo & Administracja' },
    { x: 590, y: 420, w: 160, h: 32, type: 'desk', label: 'Czytelnia Główna' }
  ];

  // ==========================================
  // CZĄSTECZKI EFEKTÓW (PARTICLES)
  // ==========================================
  let particles = [];

  function createParticles(x, y, color, count = 6) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 2.5 + 1;
      particles.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        decay: Math.random() * 0.04 + 0.02,
        color: color,
        size: Math.random() * 4 + 2
      });
    }
  }

  function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life -= p.decay;
      if (p.life <= 0) {
        particles.splice(i, 1);
      }
    }
  }

  function drawParticles() {
    particles.forEach(p => {
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  }

  // ==========================================
  // OBIEKT GRACZA (STUDENT)
  // ==========================================
  const player = {
    x: 100,
    y: 270,
    radius: 14,
    speed: 3.2,
    sprintMultiplier: 1.7,
    stamina: 100,
    maxStamina: 100,
    staminaDrainRate: 26, // na sekundę podczas sprintu
    staminaRecoverRate: 18, // na sekundę podczas odpoczynku
    isExhausted: false,
    ects: 0,
    coffeeBoost: 0, // czas pozostały boostu kawowego
    shieldTime: 0,  // czas pozostały złotej legitymacji
    direction: 0,   // kąt zwrotu w radianach
    walkCycle: 0,

    reset() {
      this.x = 100;
      this.y = 270;
      this.stamina = 100;
      this.isExhausted = false;
      this.ects = 0;
      this.coffeeBoost = 0;
      this.shieldTime = 0;
      this.direction = 0;
      this.walkCycle = 0;
    },

    update(dt) {
      let dx = 0;
      let dy = 0;

      if (keys.up) dy -= 1;
      if (keys.down) dy += 1;
      if (keys.left) dx -= 1;
      if (keys.right) dx += 1;

      // Normalizacja wektora ruchu
      if (dx !== 0 && dy !== 0) {
        dx *= 0.7071;
        dy *= 0.7071;
      }

      const isMoving = dx !== 0 || dy !== 0;

      // Obsługa sprintu
      const isSprinting = keys.sprint && isMoving && !this.isExhausted;
      let currentSpeed = this.speed;

      if (this.coffeeBoost > 0) {
        this.coffeeBoost -= dt;
        currentSpeed = this.speed * 1.85;
        this.stamina = Math.min(this.maxStamina, this.stamina + 20 * dt);
        // Ślad cząsteczek kawy
        if (Math.random() < 0.4) {
          createParticles(this.x, this.y, '#e5a93c', 1);
        }
      } else if (isSprinting) {
        currentSpeed = this.speed * this.sprintMultiplier;
        this.stamina -= this.staminaDrainRate * dt;
        if (this.stamina <= 0) {
          this.stamina = 0;
          this.isExhausted = true;
        }
        // Ślad cząsteczek sprintu
        if (Math.random() < 0.25) {
          createParticles(this.x, this.y, '#38bdf8', 1);
        }
      } else {
        // Regeneracja staminy
        if (this.stamina < this.maxStamina) {
          this.stamina += this.staminaRecoverRate * dt;
          if (this.stamina > 20) {
            this.isExhausted = false;
          }
          if (this.stamina > this.maxStamina) {
            this.stamina = this.maxStamina;
          }
        }
      }

      // Aktualizacja tarczy legitymacji
      if (this.shieldTime > 0) {
        this.shieldTime -= dt;
        if (Math.random() < 0.3) {
          createParticles(this.x, this.y, '#06b6d4', 1);
        }
      }

      // Aplikacja ruchu z detekcją kolizji (oddzielnie X i Y dla ślizgania po ścianach)
      if (isMoving) {
        const nextX = this.x + dx * currentSpeed;
        const nextY = this.y + dy * currentSpeed;

        if (!checkObstacleCollision(nextX, this.y, this.radius)) {
          this.x = nextX;
        }
        if (!checkObstacleCollision(this.x, nextY, this.radius)) {
          this.y = nextY;
        }

        this.direction = Math.atan2(dy, dx);
        this.walkCycle += dt * 10;
      }
    },

    draw() {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.direction);

      // Cień pod postacią
      ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
      ctx.beginPath();
      ctx.ellipse(0, 3, this.radius + 2, this.radius - 2, 0, 0, Math.PI * 2);
      ctx.fill();

      // Efekt Złotej Legitymacji (błyszcząca tarcza nietykalności)
      if (this.shieldTime > 0) {
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 3;
        ctx.shadowColor = '#0284c7';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius + 7, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Ramiona / ręce (kołysanie podczas chodu)
      const armSwing = Math.sin(this.walkCycle) * 3;
      ctx.fillStyle = '#0f2b48';
      ctx.beginPath();
      ctx.arc(6, -11 + armSwing, 4, 0, Math.PI * 2);
      ctx.arc(6, 11 - armSwing, 4, 0, Math.PI * 2);
      ctx.fill();

      // Ciało studenta (bluza w barwach uczelni)
      ctx.fillStyle = this.coffeeBoost > 0 ? '#b45309' : '#0b2545';
      ctx.beginPath();
      ctx.ellipse(0, 0, this.radius, this.radius - 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#e5a93c';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Plecak z notatkami i podręcznikami ALK
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.roundRect(-12, -7, 7, 14, 3);
      ctx.fill();
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(-11, -3, 5, 6);

      // Głowa i czapka studencka
      ctx.fillStyle = '#fed7aa';
      ctx.beginPath();
      ctx.arc(3, 0, 7.5, 0, Math.PI * 2);
      ctx.fill();

      // Biretet / czapka studencka (motyw ALK)
      ctx.fillStyle = '#061a33';
      ctx.beginPath();
      ctx.rect(0, -6, 7, 12);
      ctx.fill();
      ctx.fillStyle = '#e5a93c';
      ctx.beginPath();
      ctx.arc(7, 0, 2, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }
  };

  // ==========================================
  // OBIEKT EGZAMINATORA (PROF. NOWAKOWSKI)
  // ==========================================
  const professor = {
    x: 680,
    y: 270,
    radius: 15,
    speed: 2.1,
    chaseSpeed: 3.4,
    state: 'PATROL', // 'PATROL', 'CHASE' lub 'CORNERED'
    cornerTimeRemaining: 0,
    targetWaypointIndex: 0,
    direction: Math.PI,
    walkCycle: 0,
    lastQuoteTime: 0,
    detectionRange: 210,

    // Trasa patrolowa profesora po kampusie
    waypoints: [
      { x: 680, y: 100 },
      { x: 500, y: 100 },
      { x: 380, y: 160 },
      { x: 200, y: 100 },
      { x: 100, y: 300 },
      { x: 220, y: 450 },
      { x: 420, y: 360 },
      { x: 680, y: 440 }
    ],

    reset() {
      this.x = 680;
      this.y = 270;
      this.state = 'PATROL';
      this.cornerTimeRemaining = 0;
      this.targetWaypointIndex = 0;
      this.direction = Math.PI;
      this.walkCycle = 0;
      this.lastQuoteTime = 0;
    },

    update(dt) {
      // 1. Obsługa pobytu w karnym kącie po trafieniu artylerią
      if (this.state === 'CORNERED') {
        this.cornerTimeRemaining -= dt;
        this.x = CORNER_POS.x;
        this.y = CORNER_POS.y;
        this.direction = Math.PI * 0.75; // stoi tyłem do kampusu, twarzą w narożnik ściany

        if (this.cornerTimeRemaining <= 0) {
          this.state = 'PATROL';
          this.targetWaypointIndex = 0;
          showToast("⚠️ Kara w kącie dobiegła końca! Wykładowca wznawia patrol!");
        }
        return; // Podczas kary w kącie wykładowca nie może łapać studenta!
      }

      const distToPlayer = Math.hypot(player.x - this.x, player.y - this.y);
      const isPlayerShielded = player.shieldTime > 0;

      // Wykrywanie studenta: pościg jeśli student w zasięgu wzroku i bez legitymacji
      if (!isPlayerShielded && distToPlayer < this.detectionRange && hasLineOfSight(this.x, this.y, player.x, player.y)) {
        if (this.state !== 'CHASE') {
          this.state = 'CHASE';
          triggerQuote();
          if (window.KozminskiAudio) {
            window.KozminskiAudio.playAlert();
          }
        }
      } else {
        if (distToPlayer > this.detectionRange * 1.35) {
          this.state = 'PATROL';
        }
      }

      // Poruszanie profesora
      let targetX, targetY, currentSpeed;

      if (this.state === 'CHASE' && !isPlayerShielded) {
        targetX = player.x;
        targetY = player.y;
        currentSpeed = this.chaseSpeed;

        // Okresowe rzucanie cytatów podczas pościgu
        if (gameTime - this.lastQuoteTime > 5) {
          triggerQuote();
          this.lastQuoteTime = gameTime;
        }
      } else {
        const wp = this.waypoints[this.targetWaypointIndex];
        targetX = wp.x;
        targetY = wp.y;
        currentSpeed = this.speed;

        if (Math.hypot(wp.x - this.x, wp.y - this.y) < 20) {
          this.targetWaypointIndex = (this.targetWaypointIndex + 1) % this.waypoints.length;
        }
      }

      const angle = Math.atan2(targetY - this.y, targetX - this.x);
      this.direction = angle;

      const vx = Math.cos(angle) * currentSpeed;
      const vy = Math.sin(angle) * currentSpeed;

      const nextX = this.x + vx;
      const nextY = this.y + vy;

      if (!checkObstacleCollision(nextX, this.y, this.radius)) {
        this.x = nextX;
      }
      if (!checkObstacleCollision(this.x, nextY, this.radius)) {
        this.y = nextY;
      }

      this.walkCycle += dt * 8;

      // Sprawdzenie złapania studenta
      if (!isPlayerShielded && distToPlayer < (this.radius + player.radius - 2)) {
        triggerGameOver();
      }
    },

    draw() {
      ctx.save();
      ctx.translate(this.x, this.y);

      // Komiczne efekty podczas kary stania w kącie (gwiazdki ogłuszenia, czapka i licznik)
      if (this.state === 'CORNERED') {
        const starTime = performance.now() / 240;
        for (let i = 0; i < 3; i++) {
          const a = starTime + (i * Math.PI * 2) / 3;
          const sx = Math.cos(a) * 20;
          const sy = Math.sin(a) * 10 - 24;
          ctx.font = '14px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('⭐', sx, sy);
        }

        // Czapka karna z napisem ALK
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath();
        ctx.moveTo(0, -14);
        ctx.lineTo(-8, -32);
        ctx.lineTo(8, -32);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#dc2626';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Plakietka odliczania kary w kącie
        ctx.fillStyle = 'rgba(6, 21, 43, 0.9)';
        ctx.beginPath();
        ctx.roundRect(-30, -50, 60, 16, 4);
        ctx.fill();
        ctx.strokeStyle = '#ffc740';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.fillStyle = '#ffc740';
        ctx.font = 'bold 9px var(--font-body)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`W KĄCIE: ${Math.ceil(this.cornerTimeRemaining)}s`, 0, -42);
      }

      // Stożek pola widzenia / czujności w trybie pościgu
      if (this.state === 'CHASE') {
        ctx.save();
        ctx.rotate(this.direction);
        ctx.fillStyle = 'rgba(239, 68, 68, 0.12)';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, this.detectionRange, -Math.PI / 4, Math.PI / 4);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      ctx.rotate(this.direction);

      // Cień
      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      ctx.beginPath();
      ctx.ellipse(0, 3, this.radius + 3, this.radius - 2, 0, 0, Math.PI * 2);
      ctx.fill();

      // Ręce profesora (teczka w ręku)
      ctx.fillStyle = '#475569';
      ctx.beginPath();
      ctx.arc(6, -12, 4, 0, Math.PI * 2);
      ctx.arc(6, 12, 4, 0, Math.PI * 2);
      ctx.fill();

      // Teczka egzaminacyjna z protokołem
      ctx.fillStyle = '#78350f';
      ctx.fillRect(4, 10, 8, 12);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(5, 12, 6, 2);

      // Płaszcz / garnitur profesorski (szary z bordowym krawatem)
      ctx.fillStyle = this.state === 'CHASE' ? '#7f1d1d' : (this.state === 'CORNERED' ? '#475569' : '#334155');
      ctx.beginPath();
      ctx.ellipse(0, 0, this.radius, this.radius - 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = this.state === 'CORNERED' ? '#f59e0b' : (this.state === 'CHASE' ? '#ef4444' : '#64748b');
      ctx.lineWidth = this.state === 'CHASE' || this.state === 'CORNERED' ? 2 : 1;
      ctx.stroke();

      // Krawat
      ctx.fillStyle = '#dc2626';
      ctx.beginPath();
      ctx.moveTo(2, -3);
      ctx.lineTo(8, 0);
      ctx.lineTo(2, 3);
      ctx.closePath();
      ctx.fill();

      // Siwa głowa i okulary profesora
      ctx.fillStyle = '#ffedd5';
      ctx.beginPath();
      ctx.arc(4, 0, 8, 0, Math.PI * 2);
      ctx.fill();

      // Siwe włosy
      ctx.fillStyle = '#e2e8f0';
      ctx.beginPath();
      ctx.arc(-1, 0, 7.5, Math.PI / 2, -Math.PI / 2);
      ctx.fill();

      // Okulary
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(5, -6, 4, 4);
      ctx.strokeRect(5, 2, 4, 4);

      ctx.restore();
    }
  };

  // ==========================================
  // ZNAJDŹKI I PRZEDMIOTY (COLLECTIBLES)
  // ==========================================
  let items = [];

  const ITEM_TYPES = {
    ECTS_1: { name: '1 ECTS', type: 'ects', value: 1, color: '#f59e0b', icon: '📜' },
    ECTS_2: { name: '2 ECTS', type: 'ects', value: 2, color: '#e5a93c', icon: '📜' },
    ECTS_3: { name: '3 ECTS (Projekt)', type: 'ects', value: 3, color: '#d97706', icon: '📜' },
    COFFEE: { name: 'Kawa z Kawiarni ALK', type: 'coffee', color: '#854d0e', icon: '☕' },
    SHIELD: { name: 'Złota Legitymacja ALK', type: 'shield', color: '#0284c7', icon: '🪪' }
  };

  function spawnRandomItem(forceType = null) {
    let typeConfig;
    if (forceType) {
      typeConfig = forceType;
    } else {
      const rand = Math.random();
      if (rand < 0.55) {
        typeConfig = ITEM_TYPES.ECTS_1;
      } else if (rand < 0.75) {
        typeConfig = ITEM_TYPES.ECTS_2;
      } else if (rand < 0.88) {
        typeConfig = ITEM_TYPES.ECTS_3;
      } else if (rand < 0.95) {
        typeConfig = ITEM_TYPES.COFFEE;
      } else {
        typeConfig = ITEM_TYPES.SHIELD;
      }
    }

    // Losowanie wolnego miejsca bez kolizji z meblami
    let validSpot = false;
    let testX = 100;
    let testY = 100;
    let attempts = 0;

    while (!validSpot && attempts < 50) {
      attempts++;
      testX = 35 + Math.random() * (CANVAS_WIDTH - 70);
      testY = 35 + Math.random() * (CANVAS_HEIGHT - 70);

      if (!checkObstacleCollision(testX, testY, 18)) {
        validSpot = true;
      }
    }

    items.push({
      x: testX,
      y: testY,
      radius: 12,
      config: typeConfig,
      floatOffset: Math.random() * Math.PI * 2
    });
  }

  function initItems() {
    items = [];
    // Początkowy rzut punktów i kawy
    for (let i = 0; i < 9; i++) {
      spawnRandomItem();
    }
    // Gwarantowana kawa na start w pobliżu Patio
    items.push({
      x: 410,
      y: 330,
      radius: 12,
      config: ITEM_TYPES.COFFEE,
      floatOffset: 0
    });
  }

  function updateItems(dt) {
    items.forEach(it => {
      it.floatOffset += dt * 3;
    });

    // Sprawdzenie zebrania przez studenta
    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i];
      const dist = Math.hypot(player.x - it.x, player.y - it.y);

      if (dist < player.radius + it.radius) {
        collectItem(it);
        items.splice(i, 1);
        // Odrodzenie nowego przedmiotu, by mapa nigdy nie była pusta
        spawnRandomItem();
      }
    }
  }

  function collectItem(item) {
    const cfg = item.config;
    createParticles(item.x, item.y, cfg.color, 12);

    if (cfg.type === 'ects') {
      player.ects += cfg.value;
      if (window.KozminskiAudio) {
        window.KozminskiAudio.playCollectECTS(cfg.value);
      }
      showToast(`+${cfg.value} ECTS (${cfg.name})`);

      if (player.ects >= TARGET_ECTS) {
        player.ects = TARGET_ECTS;
        triggerVictory();
      }
    } else if (cfg.type === 'coffee') {
      coffeesDrunk++;
      player.coffeeBoost = 6.0; // 6 sekund superszybkości i nieskończonej staminy
      player.stamina = player.maxStamina;
      player.isExhausted = false;
      if (window.KozminskiAudio) {
        window.KozminskiAudio.playCoffeeBoost();
      }
      showToast(`☕ Kawiarnia ALK: 100% Staminy & Superspeed!`);
      triggerVignette('coffee', 1500);
    } else if (cfg.type === 'shield') {
      player.shieldTime = 6.0; // 6 sekund kamuflażu / nietykalności
      if (window.KozminskiAudio) {
        window.KozminskiAudio.playShield();
      }
      showToast(`🪪 Złota Legitymacja ALK: Niewidzialny dla profesora!`);
      triggerVignette('shield', 1500);
    }

    updateHUD();
  }

  function drawItems() {
    items.forEach(it => {
      const bobY = Math.sin(it.floatOffset) * 3;
      ctx.save();
      ctx.translate(it.x, it.y + bobY);

      // Blask wokół przedmiotu
      ctx.fillStyle = it.config.color;
      ctx.globalAlpha = 0.25;
      ctx.beginPath();
      ctx.arc(0, 0, it.radius + 6, 0, Math.PI * 2);
      ctx.fill();

      // Cień pod unoszącym się przedmiotem
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.ellipse(0, 10 - bobY, 8, 3, 0, 0, Math.PI * 2);
      ctx.fill();

      // Ikona przedmiotu
      ctx.globalAlpha = 1;
      ctx.font = '16px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(it.config.icon, 0, 0);

      ctx.restore();
    });
  }

  // ==========================================
  // LOGIKA KOLIZJI I WIDOCZNOŚCI (RAYCAST)
  // ==========================================
  function checkObstacleCollision(circleX, circleY, radius) {
    for (const obs of campusObstacles) {
      // Wyznaczanie najbliższego punktu prostokąta przeszkody do środka koła
      const closestX = Math.max(obs.x, Math.min(circleX, obs.x + obs.w));
      const closestY = Math.max(obs.y, Math.min(circleY, obs.y + obs.h));

      const distX = circleX - closestX;
      const distY = circleY - closestY;

      if ((distX * distX + distY * distY) < (radius * radius)) {
        return true;
      }
    }
    return false;
  }

  function hasLineOfSight(x1, y1, x2, y2) {
    const steps = 14;
    for (let i = 1; i < steps; i++) {
      const checkX = x1 + (x2 - x1) * (i / steps);
      const checkY = y1 + (y2 - y1) * (i / steps);

      for (const obs of campusObstacles) {
        if (checkX >= obs.x && checkX <= obs.x + obs.w &&
            checkY >= obs.y && checkY <= obs.y + obs.h) {
          return false;
        }
      }
    }
    return true;
  }

  // ==========================================
  // RYSOWANIE ŚRODOWISKA KAMPUSU ALK
  // ==========================================
  function drawCampus() {
    // 1. Tło trzech stref kampusu
    // Strefa 1: Budynek D (Korytarze i Sale)
    ctx.fillStyle = '#0a1d36';
    ctx.fillRect(0, 0, 274, CANVAS_HEIGHT);

    // Strefa 2: Zielone Patio ALK (szklany dach i terakota z motywem ogrodowym)
    ctx.fillStyle = '#0d2d30';
    ctx.fillRect(274, 0, 266, CANVAS_HEIGHT);

    // Strefa 3: Biblioteka Główna & Aula II
    ctx.fillStyle = '#0b1d33';
    ctx.fillRect(540, 0, 260, CANVAS_HEIGHT);

    // Siatka kafelków podłogowych
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.lineWidth = 1;
    const tileSize = 40;
    for (let x = 0; x < CANVAS_WIDTH; x += tileSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, CANVAS_HEIGHT);
      ctx.stroke();
    }
    for (let y = 0; y < CANVAS_HEIGHT; y += tileSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(CANVAS_WIDTH, y);
      ctx.stroke();
    }

    // Efekt szklanego dachu na Patio (delikatne pasy światła słonecznego)
    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(290 + i * 60, 0);
      ctx.lineTo(330 + i * 60, 0);
      ctx.lineTo(390 + i * 60, CANVAS_HEIGHT);
      ctx.lineTo(350 + i * 60, CANVAS_HEIGHT);
      ctx.fill();
    }
    ctx.restore();

    // 2. Rysowanie przeszkód architektonicznych kampusu
    campusObstacles.forEach(obs => {
      ctx.save();

      if (obs.type === 'wall') {
        // Ściany nośne i szklano-aluminiowe przegrody
        ctx.fillStyle = '#061324';
        ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
        ctx.strokeStyle = '#e5a93c';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(obs.x, obs.y, obs.w, obs.h);
      } else if (obs.type === 'plant') {
        // Rośliny w Patio (duże donice z monsterami i fikusami)
        ctx.fillStyle = '#064e3b';
        ctx.beginPath();
        ctx.arc(obs.x + obs.w / 2, obs.y + obs.h / 2, obs.w / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.font = '22px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🪴', obs.x + obs.w / 2, obs.y + obs.h / 2);
      } else if (obs.type === 'cafe') {
        // Kawiarnia ALK w Patio
        ctx.fillStyle = '#1c1917';
        ctx.beginPath();
        ctx.roundRect(obs.x, obs.y, obs.w, obs.h, 8);
        ctx.fill();
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = '#fef3c7';
        ctx.font = 'bold 9px var(--font-sans)';
        ctx.textAlign = 'center';
        ctx.fillText('KAWIARNIA ALK', obs.x + obs.w / 2, obs.y + 20);
        ctx.font = '20px sans-serif';
        ctx.fillText('☕', obs.x + obs.w / 2, obs.y + 42);
      } else if (obs.type === 'bookshelf') {
        // Regały z książkami w Bibliotece
        ctx.fillStyle = '#1e1b4b';
        ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
        ctx.strokeStyle = '#6366f1';
        ctx.lineWidth = 1;
        ctx.strokeRect(obs.x, obs.y, obs.w, obs.h);

        // Imitacja grzbietów książek
        ctx.fillStyle = '#818cf8';
        for (let bx = obs.x + 8; bx < obs.x + obs.w - 10; bx += 10) {
          ctx.fillRect(bx, obs.y + 4, 6, obs.h - 8);
        }

        ctx.fillStyle = '#c7d2fe';
        ctx.font = '8px var(--font-sans)';
        ctx.textAlign = 'center';
        ctx.fillText(obs.label || 'Książki', obs.x + obs.w / 2, obs.y + obs.h / 2 + 3);
      } else if (obs.type === 'desk') {
        // Biurka audytoryjne
        ctx.fillStyle = '#1e293b';
        ctx.beginPath();
        ctx.roundRect(obs.x, obs.y, obs.w, obs.h, 4);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.stroke();

        ctx.fillStyle = '#94a3b8';
        ctx.font = '8px var(--font-sans)';
        ctx.textAlign = 'center';
        ctx.fillText(obs.label || 'Biurko', obs.x + obs.w / 2, obs.y + obs.h / 2 + 3);
      }

      ctx.restore();
    });

    // Etykiety stref na podłodze
    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.font = 'bold 16px var(--font-sans)';
    ctx.textAlign = 'center';
    ctx.fillText('BUDYNEK D', 130, 32);
    ctx.fillText('ZIELONE PATIO ALK', 400, 32);
    ctx.fillText('BIBLIOTEKA GŁÓWNA', 670, 32);

    // Strefa: KARNY KĄT DZIEKANA (miejsce zesłania wykładowcy)
    ctx.fillStyle = 'rgba(239, 68, 68, 0.12)';
    ctx.fillRect(20, 452, 70, 68);
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 3]);
    ctx.strokeRect(20, 452, 70, 68);
    ctx.setLineDash([]);

    ctx.fillStyle = '#ffc740';
    ctx.font = 'bold 9px var(--font-body)';
    ctx.textAlign = 'center';
    ctx.fillText('KARNY KĄT', 55, 472);
    ctx.fillText('DZIEKANA 🎯', 55, 485);
    ctx.restore();
  }

  // ==========================================
  // OBSŁUGA INTERFEJSU HUD & POWIADOMIEŃ
  // ==========================================
  function updateHUD() {
    // ECTS
    if (currentEctsSpan) currentEctsSpan.textContent = player.ects;
    if (ectsProgressBar) {
      const pct = Math.min(100, (player.ects / TARGET_ECTS) * 100);
      ectsProgressBar.style.width = `${pct}%`;
    }

    // Stamina
    const stamPct = Math.round((player.stamina / player.maxStamina) * 100);
    if (staminaValue) staminaValue.textContent = `${stamPct}%`;
    if (staminaProgressBar) {
      staminaProgressBar.style.width = `${stamPct}%`;
      if (stamPct < 25) {
        staminaProgressBar.classList.add('low');
      } else {
        staminaProgressBar.classList.remove('low');
      }
    }

    // Lokalizacja studenta na kampusie ALK
    let loc = 'Budynek D (Korytarze)';
    if (player.x > 260 && player.x < 540) {
      loc = 'Zielone Patio ALK (Oaza Spokoju)';
    } else if (player.x >= 540) {
      loc = 'Biblioteka Główna & Aule';
    }
    if (campusLocation) campusLocation.textContent = loc;

    // Status zagrożenia
    if (dangerStatus && dangerText) {
      if (professor.state === 'CORNERED') {
        dangerStatus.className = 'danger-badge safe';
        dangerText.textContent = `Wykładowca w kącie (${Math.ceil(professor.cornerTimeRemaining)}s)`;
      } else if (professor.state === 'CHASE') {
        dangerStatus.className = 'danger-badge chase';
        dangerText.textContent = 'POŚCIG! Egzaminator Cię goni!';
        if (screenVignette && !screenVignette.classList.contains('coffee') && !screenVignette.classList.contains('shield') && !screenVignette.classList.contains('artillery')) {
          screenVignette.className = 'screen-vignette danger';
        }
      } else {
        dangerStatus.className = 'danger-badge safe';
        dangerText.textContent = 'Egzaminator patroluje';
        if (screenVignette && !screenVignette.classList.contains('coffee') && !screenVignette.classList.contains('shield') && !screenVignette.classList.contains('artillery')) {
          screenVignette.className = 'screen-vignette';
        }
      }
    }

    // Artyleria - stan przycisku HUD i mobilnego (gotowy vs czas odnowienia)
    if (artilleryBtn && artilleryHudTimer) {
      if (artilleryTimer <= 0) {
        artilleryBtn.classList.remove('cooldown');
        artilleryBtn.classList.add('ready');
        artilleryHudTimer.textContent = 'KĄT [Q]';
        artilleryBtn.title = '🎯 Artyleria Dziekanatu [Q] - GOTOWA! Wyślij wykładowcę do kąta na 10 sekund!';
      } else {
        artilleryBtn.classList.remove('ready');
        artilleryBtn.classList.add('cooldown');
        const rem = Math.ceil(artilleryTimer);
        const m = Math.floor(rem / 60);
        const s = rem % 60;
        artilleryHudTimer.textContent = m > 0 ? `${m}m ${s < 10 ? '0' : ''}${s}s` : `${s}s`;
        artilleryBtn.title = `Artyleria ładuje się (${rem}s do odnowienia)`;
      }
    }

    if (touchArtilleryBtn && touchArtilleryText) {
      if (artilleryTimer <= 0) {
        touchArtilleryBtn.classList.remove('cooldown');
        touchArtilleryBtn.classList.add('ready');
        touchArtilleryText.textContent = 'KĄT [Q]';
      } else {
        touchArtilleryBtn.classList.remove('ready');
        touchArtilleryBtn.classList.add('cooldown');
        const rem = Math.ceil(artilleryTimer);
        touchArtilleryText.textContent = `${rem}s`;
      }
    }
  }

  function triggerQuote() {
    if (!professorBubble || !bubbleQuoteText) return;
    const randomQuote = PROFESSOR_QUOTES[Math.floor(Math.random() * PROFESSOR_QUOTES.length)];
    bubbleQuoteText.textContent = `„${randomQuote}”`;
    professorBubble.classList.add('active');

    clearTimeout(bubbleTimeout);
    bubbleTimeout = setTimeout(() => {
      professorBubble.classList.remove('active');
    }, 4500);
  }

  function showToast(message) {
    if (!powerupToast) return;
    powerupToast.textContent = message;
    powerupToast.classList.add('active');

    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
      powerupToast.classList.remove('active');
    }, 2400);
  }

  function triggerVignette(type, durationMs = 1500) {
    if (!screenVignette) return;
    screenVignette.className = `screen-vignette ${type}`;
    setTimeout(() => {
      if (professor.state === 'CHASE') {
        screenVignette.className = 'screen-vignette danger';
      } else {
        screenVignette.className = 'screen-vignette';
      }
    }, durationMs);
  }

  function formatTime(totalSecs) {
    const mins = Math.floor(totalSecs / 60).toString().padStart(2, '0');
    const secs = Math.floor(totalSecs % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  }

  // ==========================================
  // EKRANY MODALNE (GAME OVER & ZWYCIĘSTWO)
  // ==========================================
  function triggerGameOver() {
    currentState = GameState.GAME_OVER;
    if (window.KozminskiAudio) {
      window.KozminskiAudio.playGameOver();
    }

    if (finalFailedEcts) finalFailedEcts.textContent = player.ects;
    if (finalSurvivalTime) finalSurvivalTime.textContent = formatTime(gameTime);
    if (finalCoffeesDrunk) finalCoffeesDrunk.textContent = coffeesDrunk;

    if (gameOverModal) gameOverModal.classList.add('active');
  }

  function triggerVictory() {
    currentState = GameState.VICTORY;
    if (window.KozminskiAudio) {
      window.KozminskiAudio.playVictory();
    }

    const bonus = Math.max(0, Math.floor(3000 - gameTime * 25));
    const totalScore = player.ects * 100 + bonus + (coffeesDrunk * 50);

    if (victoryEcts) victoryEcts.textContent = player.ects;
    if (victoryTime) victoryTime.textContent = formatTime(gameTime);
    if (victoryScore) victoryScore.textContent = totalScore;

    if (victoryModal) victoryModal.classList.add('active');
  }

  function startGame() {
    if (window.KozminskiAudio) {
      window.KozminskiAudio.init();
      window.KozminskiAudio.resumeContext();
    }

    if (startModal) startModal.classList.remove('active');
    if (gameOverModal) gameOverModal.classList.remove('active');
    if (victoryModal) victoryModal.classList.remove('active');

    player.reset();
    professor.reset();
    initItems();
    particles = [];
    gameTime = 0;
    coffeesDrunk = 0;
    artilleryTimer = 0; // Gotowa od początku rundy!
    screenShakeTime = 0;
    artilleryImpactAnim = null;
    currentState = GameState.PLAYING;
    lastTimestamp = performance.now();

    updateHUD();
    showToast("Sesja rozpoczęta! Zbieraj ECTS i pamiętaj o Artylerii [Q]!");
  }

  function togglePause() {
    if (currentState === GameState.PLAYING) {
      currentState = GameState.PAUSED;
      if (pauseIcon) pauseIcon.textContent = '▶️';
      showToast("Gra wstrzymana");
    } else if (currentState === GameState.PAUSED) {
      currentState = GameState.PLAYING;
      if (pauseIcon) pauseIcon.textContent = '⏸️';
      lastTimestamp = performance.now();
      showToast("Wznowiono grę");
    }
  }

  // ==========================================
  // LOGIKA ARTYLERII (ODESŁANIE WYKŁADOWCY DO KĄTA)
  // ==========================================
  function fireArtillery() {
    if (currentState !== GameState.PLAYING) return;

    if (artilleryTimer > 0) {
      const remainingSecs = Math.ceil(artilleryTimer);
      const mins = Math.floor(remainingSecs / 60);
      const secs = remainingSecs % 60;
      const timeStr = mins > 0 ? `${mins}m ${secs < 10 ? '0' : ''}${secs}s` : `${secs}s`;
      showToast(`⏳ Artyleria ładuje się! Dostępna za: ${timeStr}`);
      return;
    }

    // Aktywacja artylerii na 2 minuty (120 sekund cooldownu)
    artilleryTimer = ARTILLERY_COOLDOWN;
    screenShakeTime = 0.55;

    if (window.KozminskiAudio) {
      window.KozminskiAudio.playArtilleryStrike();
    }

    triggerVignette('artillery', 1800);
    showToast("🎯 ARTYLERIA DZIEKANATU! Wykładowca odesłany do kąta na 10 sekund!");

    // Cząsteczki uderzenia
    createParticles(professor.x, professor.y, '#f59e0b', 24);
    createParticles(professor.x, professor.y, '#ef4444', 18);
    createParticles(professor.x, professor.y, '#ffffff', 12);

    // Animacja celownika
    artilleryImpactAnim = {
      x: professor.x,
      y: professor.y,
      maxRadius: 60,
      time: 0.75,
      maxTime: 0.75
    };

    // Teleportacja do Karnego Kąta Dziekana i nałożenie kary
    professor.x = CORNER_POS.x;
    professor.y = CORNER_POS.y;
    professor.state = 'CORNERED';
    professor.cornerTimeRemaining = CORNER_DURATION;
    professor.direction = Math.PI * 0.75;

    // Komentarz profesora o karze
    const randomCornerQuote = CORNER_QUOTES[Math.floor(Math.random() * CORNER_QUOTES.length)];
    if (bubbleQuoteText && professorBubble) {
      bubbleQuoteText.textContent = `„${randomCornerQuote}”`;
      professorBubble.classList.add('active');
      clearTimeout(bubbleTimeout);
      bubbleTimeout = setTimeout(() => {
        professorBubble.classList.remove('active');
      }, 5000);
    }

    updateHUD();
  }

  function drawArtilleryImpact(dt) {
    if (!artilleryImpactAnim) return;
    artilleryImpactAnim.time -= dt;
    if (artilleryImpactAnim.time <= 0) {
      artilleryImpactAnim = null;
      return;
    }

    const { x, y, maxRadius, time, maxTime } = artilleryImpactAnim;
    const progress = 1 - (time / maxTime);
    const curRadius = maxRadius * (1 - progress * 0.4);

    ctx.save();
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 3;
    ctx.shadowColor = '#f59e0b';
    ctx.shadowBlur = 16;

    // Okrąg celownika
    ctx.beginPath();
    ctx.arc(x, y, curRadius, 0, Math.PI * 2);
    ctx.stroke();

    // Linie celownika
    ctx.beginPath();
    ctx.moveTo(x - curRadius - 10, y);
    ctx.lineTo(x + curRadius + 10, y);
    ctx.moveTo(x, y - curRadius - 10);
    ctx.lineTo(x, y + curRadius + 10);
    ctx.stroke();

    ctx.restore();
  }

  // ==========================================
  // PĘTLA GŁÓWNA GRY (GAME LOOP)
  // ==========================================
  function gameLoop(timestamp) {
    animationFrameId = requestAnimationFrame(gameLoop);

    if (!lastTimestamp) lastTimestamp = timestamp;
    const dt = Math.min((timestamp - lastTimestamp) / 1000, 0.1);
    lastTimestamp = timestamp;

    if (currentState === GameState.PLAYING) {
      gameTime += dt;

      // Odliczanie czasu odnowienia Artylerii
      if (artilleryTimer > 0) {
        artilleryTimer = Math.max(0, artilleryTimer - dt);
      }

      // Aktualizacja stanu obiektów
      player.update(dt);
      professor.update(dt);
      updateItems(dt);
      updateParticles();
      updateHUD();
    }

    // Renderowanie sceny (z efektem wstrząsu ekranu przy artylerii)
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.save();

    if (screenShakeTime > 0) {
      screenShakeTime -= dt;
      const mag = Math.min(8, screenShakeTime * 16);
      ctx.translate((Math.random() - 0.5) * mag, (Math.random() - 0.5) * mag);
    }

    drawCampus();
    drawItems();
    drawParticles();
    player.draw();
    professor.draw();
    drawArtilleryImpact(dt);

    ctx.restore();

    // Rysowanie nakładki pauzy
    if (currentState === GameState.PAUSED) {
      ctx.fillStyle = 'rgba(6, 21, 43, 0.7)';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      ctx.fillStyle = '#e5a93c';
      ctx.font = 'bold 36px var(--font-sans)';
      ctx.textAlign = 'center';
      ctx.fillText('PAUZA W SESJI', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 10);

      ctx.fillStyle = '#cbd5e1';
      ctx.font = '16px var(--font-sans)';
      ctx.fillText('Naciśnij Spację lub dotknij ekranu, aby wznowić', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 30);
    }
  }

  // ==========================================
  // OBSŁUGA ZDARZEŃ KLAWIATURY I PRZYCISKÓW
  // ==========================================
  window.addEventListener('keydown', (e) => {
    if (window.KozminskiAudio) window.KozminskiAudio.resumeContext();

    switch (e.code) {
      case 'KeyW':
      case 'ArrowUp':
        keys.up = true;
        break;
      case 'KeyS':
      case 'ArrowDown':
        keys.down = true;
        break;
      case 'KeyA':
      case 'ArrowLeft':
        keys.left = true;
        break;
      case 'KeyD':
      case 'ArrowRight':
        keys.right = true;
        break;
      case 'ShiftLeft':
      case 'ShiftRight':
        keys.sprint = true;
        break;
      case 'KeyQ':
        fireArtillery();
        break;
      case 'Space':
        e.preventDefault();
        togglePause();
        break;
      case 'KeyM':
        if (soundToggleBtn) soundToggleBtn.click();
        break;
    }
  });

  window.addEventListener('keyup', (e) => {
    switch (e.code) {
      case 'KeyW':
      case 'ArrowUp':
        keys.up = false;
        break;
      case 'KeyS':
      case 'ArrowDown':
        keys.down = false;
        break;
      case 'KeyA':
      case 'ArrowLeft':
        keys.left = false;
        break;
      case 'KeyD':
      case 'ArrowRight':
        keys.right = false;
        break;
      case 'ShiftLeft':
      case 'ShiftRight':
        keys.sprint = false;
        break;
    }
  });

  // ==========================================
  // OBSŁUGA KONTROLERA DOTYKOWEGO (SMARTFON/TABLET)
  // ==========================================
  function bindTouchButton(btn, keyProp) {
    if (!btn) return;
    const startHandler = (e) => {
      e.preventDefault();
      if (window.KozminskiAudio) window.KozminskiAudio.resumeContext();
      keys[keyProp] = true;
      btn.classList.add('active');
    };
    const endHandler = (e) => {
      e.preventDefault();
      keys[keyProp] = false;
      btn.classList.remove('active');
    };

    btn.addEventListener('touchstart', startHandler, { passive: false });
    btn.addEventListener('touchend', endHandler, { passive: false });
    btn.addEventListener('touchcancel', endHandler, { passive: false });
    btn.addEventListener('mousedown', startHandler);
    btn.addEventListener('mouseup', endHandler);
    btn.addEventListener('mouseleave', endHandler);
  }

  bindTouchButton(touchUp, 'up');
  bindTouchButton(touchDown, 'down');
  bindTouchButton(touchLeft, 'left');
  bindTouchButton(touchRight, 'right');
  bindTouchButton(touchSprintBtn, 'sprint');

  if (touchArtilleryBtn) {
    touchArtilleryBtn.addEventListener('click', (e) => {
      e.preventDefault();
      fireArtillery();
    });
    touchArtilleryBtn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      fireArtillery();
    }, { passive: false });
  }

  if (touchPauseBtn) {
    touchPauseBtn.addEventListener('click', () => {
      togglePause();
    });
  }

  // ==========================================
  // INICJALIZACJA PRZYCISKÓW MODALI & HUD
  // ==========================================
  if (startGameBtn) {
    startGameBtn.addEventListener('click', startGame);
  }
  if (restartGameBtn) {
    restartGameBtn.addEventListener('click', startGame);
  }
  if (playAgainBtn) {
    playAgainBtn.addEventListener('click', startGame);
  }
  if (pauseToggleBtn) {
    pauseToggleBtn.addEventListener('click', togglePause);
  }
  if (artilleryBtn) {
    artilleryBtn.addEventListener('click', () => {
      fireArtillery();
    });
  }

  if (soundToggleBtn) {
    soundToggleBtn.addEventListener('click', () => {
      if (window.KozminskiAudio) {
        window.KozminskiAudio.init();
        window.KozminskiAudio.resumeContext();
        const muted = window.KozminskiAudio.toggleMute();
        if (soundIcon) {
          soundIcon.textContent = muted ? '🔇' : '🔊';
        }
        showToast(muted ? "Dźwięk wyciszony" : "Dźwięk włączony");
      }
    });
  }

  // Rozpoczęcie pętli gry
  initItems();
  updateHUD();
  animationFrameId = requestAnimationFrame(gameLoop);

})();
