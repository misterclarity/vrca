/* global AFRAME, THREE */
// config.js — extracted from index.html (slice 2 de-monolith).
// Loaded as an ORDERED classic script at end of <body>: config.js -> systems.js
// -> game.js. Classic scripts share one global lexical scope and run in order,
// so top-level const/let/function bindings are visible across the three files.
// Constants, DOM refs, moveData/movesReady, state, DIFFICULTY, LEVELS, ACHIEVEMENTS.

    // --- CONSTANTS ---
    const DEFAULT_RODA_TIME = 10;
    const SLOW_MOTION_SCALE = 0.4;
    const NORMAL_TIME_SCALE = 1;
    const DEFENSIVE_START_INDEX = 0;
    const OFFENSIVE_START_INDEX = 0;
    const DEFAULT_MODEL_ROTATION = 0;
    const FACING_AWAY_ROTATION = 180;

    // Welcome screen elements
    const welcomeLevelText = document.getElementById("welcomeLevelText");
    const welcomeXPText = document.getElementById("welcomeXPText");
    const welcomeHighScore = document.getElementById("welcomeHighScore");
    const diffEasy = document.getElementById("diffEasy");
    const diffNormal = document.getElementById("diffNormal");
    const diffHard = document.getElementById("diffHard");

    // --- DOM ELEMENTS ---
    const entity = document.getElementById("model");
    const instructionText = document.getElementById("instructionText");
    const instructionPanel = document.getElementById("instructionPanel");
    const helpScreen = document.getElementById("helpScreen");
    const moveTitleText = document.getElementById("moveTitleText");
    const moveTitlePanel = document.getElementById("moveTitlePanel");
    const timerText = document.getElementById("timerText");
    const timerPanel = document.getElementById("timerPanel");
    const leftHand = document.getElementById("leftHand");
    const rightHand = document.getElementById("rightHand");
    const welcomeScreen = document.getElementById("welcomeScreen");
    const statsPanel = document.getElementById("statsPanel");
    const hitsText = document.getElementById("hitsText");
    const blocksText = document.getElementById("blocksText");
    const bestComboText = document.getElementById("bestComboText");
    const modePanel = document.getElementById("modePanel");
    const modeText = document.getElementById("modeText");
    const difficultyText = document.getElementById("difficultyText");
    const statusIcon = document.getElementById("statusIcon");
    const combatFeedbackPanel = document.getElementById("combatFeedbackPanel");

    // Moves reference clip slugs from assets/moves.json (played via clip-player),
    // grouped by curated category. Populated async before gameplay; a small
    // fallback keeps things working if the manifest is slow/unavailable.
    const moveData = {
      offensive: [{ slug: "martelo", title: "Martelo" }],
      defensive: [{ slug: "troca-de-pe", title: "Troca" }],
    };

    const movesReady = fetch("assets/moves.json")
      .then((r) => r.json())
      .then((list) => {
        const off = [], def = [];
        list.forEach((m) => {
          if (m.type === "offensive") off.push({ slug: m.slug, title: m.title });
          else if (m.type === "defensive") def.push({ slug: m.slug, title: m.title });
        });
        if (off.length) moveData.offensive = off;
        if (def.length) moveData.defensive = def;
      })
      .catch((e) => console.error("[moves] manifest load failed", e));

    // --- STATE ---
    let state = {
      isGameStarted: false,
      currentDefensiveIndex: DEFENSIVE_START_INDEX,
      currentOffensiveIndex: OFFENSIVE_START_INDEX,
      isRodaModeActive: false,
      isSparMode: false,
      isChallengeMode: false,
      rodaInterval: null,
      timeLeft: DEFAULT_RODA_TIME,
      isFacingAway: false,
      isHelpVisible: false,
      currentMoveType: 'defensive',
      colliders: [], // Track dynamic colliders
      sessionStartTime: null,
      showingSummary: false
    };

    // --- DIFFICULTY SETTINGS ---
    const DIFFICULTY = {
      easy: {
        name: 'Easy',
        animationSpeed: 0.6,
        hitCooldown: 700,
        blockPoints: 15,
        hitPenalty: 3,
        comboBonus: 5,
        xpMultiplier: 0.8,
        rodaTime: 15
      },
      normal: {
        name: 'Normal',
        animationSpeed: 1.0,
        hitCooldown: 500,
        blockPoints: 25,
        hitPenalty: 5,
        comboBonus: 10,
        xpMultiplier: 1.0,
        rodaTime: 10
      },
      hard: {
        name: 'Hard',
        animationSpeed: 1.4,
        hitCooldown: 350,
        blockPoints: 40,
        hitPenalty: 10,
        comboBonus: 20,
        xpMultiplier: 1.5,
        rodaTime: 7
      }
    };

    // --- LEVEL/BELT SYSTEM ---
    const LEVELS = [
      { level: 1, name: 'Iniciante', xpRequired: 0, color: '#ffffff' },
      { level: 2, name: 'Batizado', xpRequired: 100, color: '#ffd93d' },
      { level: 3, name: 'Graduado', xpRequired: 300, color: '#ffa500' },
      { level: 4, name: 'Intermediário', xpRequired: 600, color: '#00d4ff' },
      { level: 5, name: 'Avançado', xpRequired: 1000, color: '#6bcb77' },
      { level: 6, name: 'Formado', xpRequired: 1500, color: '#9b59b6' },
      { level: 7, name: 'Formado+', xpRequired: 2200, color: '#e74c3c' },
      { level: 8, name: 'Mestre', xpRequired: 3000, color: '#1a1a2e' }
    ];

    // --- ACHIEVEMENTS ---
    const ACHIEVEMENTS = {
      firstBlock: { id: 'firstBlock', name: 'First Block!', description: 'Block your first attack', unlocked: false },
      combo5: { id: 'combo5', name: 'Combo Master', description: 'Reach a 5x combo', unlocked: false },
      combo10: { id: 'combo10', name: 'Unstoppable!', description: 'Reach a 10x combo', unlocked: false },
      blocks10: { id: 'blocks10', name: 'Defender', description: 'Block 10 attacks in one session', unlocked: false },
      blocks25: { id: 'blocks25', name: 'Iron Defense', description: 'Block 25 attacks in one session', unlocked: false },
      score500: { id: 'score500', name: 'Rising Star', description: 'Score 500 points', unlocked: false },
      score1000: { id: 'score1000', name: 'Champion', description: 'Score 1000 points', unlocked: false },
      noHits: { id: 'noHits', name: 'Untouchable', description: 'Complete a Roda round without getting hit', unlocked: false },
      level5: { id: 'level5', name: 'Dedicated', description: 'Reach Level 5', unlocked: false },
      hardMode: { id: 'hardMode', name: 'Fearless', description: 'Complete a session on Hard difficulty', unlocked: false }
    };

