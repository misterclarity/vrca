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

    // Every A-Frame stock font is ASCII-only, so 18 of the 58 playable move
    // names ("Aú", "Benção", "Chapéu de couro"...) silently lost characters.
    // This atlas is DejaVu Sans over the full Latin-1 range, generated as a
    // plain SDF: that's the field type all of A-Frame's stock fonts use, and
    // its shader renders cleanly. An msdf build of the same glyphs picks up a
    // dark halo through A-Frame's msdf shader, so keep "msdf" out of the
    // filename too — A-Frame switches shader on that substring.
    const CARD_FONT = 'assets/fonts/capoeira-sdf.json';

    // Hold the right B button this long to end the session (a tap advances the
    // defensive move instead, so ending can't happen by accident).
    const END_SESSION_HOLD_MS = 900;
    // Thumbstick deflection that counts as a menu left/right nudge.
    const STICK_DEADZONE = 0.6;
    // How long a coach hint / the controls card stay up before self-dismissing.
    const COACH_MS = 4000;
    const CONTROLS_CARD_MS = 12000;

    // --- CONTROL MAP -------------------------------------------------------
    // Single source of truth for both the bindings in game.js and the text on
    // the in-world controls card. Quest 2 hardware only reports X/Y on the LEFT
    // controller and A/B on the RIGHT one, so every label below names the hand
    // that actually owns the button.
    const CONTROLS = {
      menu: {
        hands: [
          ['Pinch R', 'Start session'],
          ['Hold R', 'Cycle difficulty'],
          ['Pinch both', 'This card'],
        ],
        vr: [
          ['A', 'Start session'],
          ['Stick < >', 'Difficulty'],
          ['X', 'Cycle difficulty'],
          ['Trigger', 'Turn opponent'],
        ],
        desktop: [
          ['Space', 'Start session'],
          ['1 2 3', 'Difficulty'],
          ['T', 'Turn opponent'],
        ],
      },
      session: {
        // Bare hands have no buttons, so the whole scheme collapses onto two
        // pinches x (tap, hold), plus a two-handed pinch for the reference.
        hands: [
          ['Pinch R', 'Next attack'],
          ['Pinch L', 'Next defence'],
          ['Hold R', 'Cycle mode'],
          ['Hold L', 'End session'],
          ['Pinch both', 'This card'],
        ],
        vr: [
          ['A', 'Next attack'],
          ['B', 'Next defence'],
          ['X', 'Roda mode'],
          ['Y', 'Spar mode'],
          ['Trigger', 'Turn opponent'],
          ['Grip hold', 'Slow motion'],
          ['B hold', 'End session'],
        ],
        desktop: [
          ['J', 'Next attack'],
          ['K', 'Next defence'],
          ['R', 'Roda mode'],
          ['F', 'Spar mode'],
          ['T', 'Turn opponent'],
          ['Shift hold', 'Slow motion'],
          ['E', 'End session'],
        ],
      },
      // Rendered as the card's footer so the dismiss gesture is always stated.
      dismiss: {
        hands: 'pinch both hands to close',
        vr: 'thumbstick press to close',
        desktop: 'H to close'
      },
    };

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
    const topBar = document.getElementById("topBar");
    const controlsCard = document.getElementById("controlsCard");
    const controlsCardBg = document.getElementById("controlsCardBg");
    const controlsCardTitle = document.getElementById("controlsCardTitle");
    const controlsCardRows = document.getElementById("controlsCardRows");
    const controlsCardFooter = document.getElementById("controlsCardFooter");
    const welcomeStartHint = document.getElementById("welcomeStartHint");
    const welcomeDiffHint = document.getElementById("welcomeDiffHint");
    const summaryContinueHint = document.getElementById("summaryContinueHint");
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
    const leftGuard = document.getElementById("leftGuard");
    const rightGuard = document.getElementById("rightGuard");

    // Moves reference clip slugs from assets/moves.json (played via clip-player),
    // grouped by curated category. A small fallback keeps things working until
    // the manifest arrives; game.js fills this in from clip-player's
    // 'clip-manifest-ready' event rather than fetching the file a second time.
    const moveData = {
      offensive: [{ slug: "martelo", title: "Martelo" }],
      defensive: [{ slug: "troca-de-pe", title: "Troca" }],
    };

    // --- STATE ---
    let state = {
      isGameStarted: false,
      currentDefensiveIndex: DEFENSIVE_START_INDEX,
      currentOffensiveIndex: OFFENSIVE_START_INDEX,
      isRodaModeActive: false,
      isSparMode: false,
      isChallengeMode: false,
      timeLeft: DEFAULT_RODA_TIME,
      isFacingAway: false,
      isHelpVisible: false,
      usingHands: false,   // bare-hand tracking live, rather than controllers
      currentMoveType: 'defensive',
      onboardingStep: 0,   // index into ONBOARDING while the first session runs
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

    // --- FIRST-RUN ONBOARDING ---
    // Three short coach lines, one at a time, shown only on a player's first
    // session. This replaces dumping the whole control list on screen: each line
    // teaches one thing and then gets out of the way.
    const ONBOARDING = {
      vr: [
        'Right: [A] attack   [B] defence',
        'Left: [X] Roda   [Y] Spar',
        'Thumbstick press = controls card',
      ],
      desktop: [
        'J = attack   K = defence',
        'R = Roda   F = Spar',
        'Press H for all controls',
      ],
      hands: [
        'Pinch right = attack, left = defence',
        'Hold a right pinch to cycle mode',
        'Pinch both hands for all controls',
      ],
    };

