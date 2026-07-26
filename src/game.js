/* global AFRAME, THREE */
// game.js — extracted from index.html (slice 2 de-monolith).
// Loaded as an ORDERED classic script at end of <body>: config.js -> systems.js
// -> game.js. Classic scripts share one global lexical scope and run in order,
// so top-level const/let/function bindings are visible across the three files.
// Game-flow / model / roda / input functions + controller-event bootstrap.

    // --- GAME FLOW FUNCTIONS ---

    function startGame() {
      if (state.isGameStarted) return;

      // If showing summary, dismiss it and return to welcome
      if (state.showingSummary) {
        gameScore.hideSummary();
        resetToWelcome();
        return;
      }

      state.isGameStarted = true;
      state.sessionStartTime = Date.now();

      // Reset session stats
      gameScore.reset();
      combatFeedback.reset();

      // Hide welcome screen
      welcomeScreen.setAttribute('visible', false);

      // Show the in-session readouts as one group.
      hud.showGamePanels(true);

      // Update mode indicator
      if (modeText) {
        modeText.setAttribute('text', 'value', 'TRAINING');
        modeText.setAttribute('text', 'color', '#00d4ff');
      }

      // Apply difficulty animation speed
      const diff = DIFFICULTY[gameData.currentDifficulty];
      entity.setAttribute("clip-player", "timeScale", diff.animationSpeed);

      // Load first model
      updateModel(state.currentMoveType);

      // First-timers get three spaced one-line lessons; everyone else just gets
      // told where the reference lives, once.
      if (!gameData.seenOnboarding) hud.startOnboarding();
    }

    function endSession() {
      if (!state.isGameStarted) return;

      // Stop any active modes
      if (state.isRodaModeActive) {
        clearInterval(state.rodaInterval);
        state.rodaInterval = null;
        state.isRodaModeActive = false;
      }
      state.isSparMode = false;
      recenterOpponent();

      // Calculate and save session results
      gameScore.endSession();

      // Show summary
      gameScore.showSummary();
    }

    function resetToWelcome() {
      state.isGameStarted = false;
      state.isRodaModeActive = false;
      state.isSparMode = false;
      state.isChallengeMode = false;
      state.showingSummary = false;
      state.currentDefensiveIndex = DEFENSIVE_START_INDEX;
      state.currentOffensiveIndex = OFFENSIVE_START_INDEX;
      recenterOpponent();

      // Hide all game panels
      hud.stopOnboarding();
      hud.clearCoach();
      hud.hideControls();
      hud.showGamePanels(false);
      [timerPanel, summaryScreen].forEach(p => p && p.setAttribute('visible', false));

      // Update and show welcome screen
      gameData.updateWelcomeScreen();
      welcomeScreen.setAttribute('visible', true);
    }

    // The controls reference is a wrist card now, not a modal — it no longer
    // blanks the HUD, and it works on the menu screens too.
    function toggleControlsCard() {
      hud.toggleControls();
    }

    // Legacy name, kept as its own declaration so it stays a window property
    // for the feature-detecting callers in desktop-fallback.js.
    function toggleHelpScreen() {
      hud.toggleControls();
    }

    const DIFFICULTY_ORDER = ['easy', 'normal', 'hard'];

    function setDifficulty(diff) {
      if (state.isGameStarted) return; // Can't change during game
      gameData.setDifficulty(diff);
      hud.coach(`Difficulty: ${DIFFICULTY[diff].name}`, '#ffd93d', 2000);
    }

    // Thumbstick left/right on the welcome screen. Nudging a stick to pick an
    // option is the expected menu gesture; the per-difficulty buttons the old
    // build used were both unreachable and unguessable.
    function stepDifficulty(delta) {
      if (state.isGameStarted || state.showingSummary) return;
      const i = DIFFICULTY_ORDER.indexOf(gameData.currentDifficulty);
      const next = Math.min(DIFFICULTY_ORDER.length - 1, Math.max(0, i + delta));
      if (next === i) return;
      setDifficulty(DIFFICULTY_ORDER[next]);
      pulse('both', 0.3, 40);
    }

    function cycleDifficulty() {
      if (state.isGameStarted || state.showingSummary) return;
      const i = DIFFICULTY_ORDER.indexOf(gameData.currentDifficulty);
      setDifficulty(DIFFICULTY_ORDER[(i + 1) % DIFFICULTY_ORDER.length]);
      pulse('both', 0.3, 40);
    }

    // --- MODEL UPDATE FUNCTIONS ---

    // opponent-ai walks the opponent toward the player while sparring; this
    // puts it back on its mark so a session never starts with it off-screen.
    function recenterOpponent() {
      const ai = entity.components['opponent-ai'];
      if (ai) ai.recenter();
    }

    function getRandomMove(moveType) {
      const moves = moveData[moveType];
      const randomIndex = Math.floor(Math.random() * moves.length);
      return moves[randomIndex];
    }

    function getNextSequentialMove(moveType) {
      const moves = moveData[moveType];
      let currentIndex;

      if (moveType === 'offensive') {
        currentIndex = state.currentOffensiveIndex;
        state.currentOffensiveIndex = (currentIndex + 1) % moves.length;
      } else {
        currentIndex = state.currentDefensiveIndex;
        state.currentDefensiveIndex = (currentIndex + 1) % moves.length;
      }
      return moves[currentIndex];
    }

    function updateModel(moveType, isRodaMode = false) {
      state.currentMoveType = moveType;
      let move;

      if (isRodaMode) {
        move = getRandomMove(moveType);
      } else {
        move = getNextSequentialMove(moveType);
      }

      // Play the move as a lazy external clip on the persistent opponent mesh.
      // (hit-detect stays attached to the mesh; no collider re-creation needed.)
      const cp = entity.components['clip-player'];
      if (cp) {
        cp.playMove(move.slug);
      } else {
        entity.addEventListener('clip-ready', () => {
          const c = entity.components['clip-player'];
          if (c) c.playMove(move.slug);
        }, { once: true });
      }

      // Update move title (shorter format for new UI)
      if (moveTitleText) {
        moveTitleText.setAttribute('text', 'value', move.title);
      }

      // A hint about the current move, which then gets out of the way. While
      // onboarding is still running, don't talk over it.
      if (state.isGameStarted && !hud.onboardingTimeout) {
        hud.coach(
          moveType === 'offensive' ? 'Block this attack with a hand' : 'Study this defensive move',
          '#9fb3c8',
          3000
        );
      }

      const yRotation = state.isFacingAway ? FACING_AWAY_ROTATION : DEFAULT_MODEL_ROTATION;
      entity.setAttribute("rotation", `0 ${yRotation} 0`);
    }

    // Set initial model for display on the welcome screen
    updateModel(state.currentMoveType);

    // clip-player already fetches assets/moves.json to build its clip table, so
    // reuse the parsed result instead of requesting the same file again. Until
    // it lands, moveData holds a one-entry-per-category fallback; refresh the
    // displayed move once the real list is in so the welcome screen isn't stuck
    // on it.
    function adoptManifest(list) {
      const off = [], def = [];
      list.forEach((m) => {
        if (m.type === "offensive") off.push({ slug: m.slug, title: m.title });
        else if (m.type === "defensive") def.push({ slug: m.slug, title: m.title });
      });
      if (off.length) moveData.offensive = off;
      if (def.length) moveData.defensive = def;
      if (!state.isGameStarted) {
        state.currentDefensiveIndex = DEFENSIVE_START_INDEX;
        state.currentOffensiveIndex = OFFENSIVE_START_INDEX;
        updateModel(state.currentMoveType);
      }
    }

    entity.addEventListener('clip-manifest-ready', (e) => {
      if (e.detail && e.detail.moves) adoptManifest(e.detail.moves);
    }, { once: true });

    // --- RODA MODE FUNCTIONS ---

    function updateTimer() {
      if (timerText) {
        timerText.setAttribute('text', 'value', `${state.timeLeft}s`);
        // Color change when time is low
        const color = state.timeLeft <= 3 ? '#ff6b6b' : '#ffd93d';
        timerText.setAttribute('text', 'color', color);
      }
    }

    function startRodaSequence() {
      let isOffensive = Math.random() < 0.5;
      const rodaTime = DIFFICULTY[gameData.currentDifficulty].rodaTime;
      state.timeLeft = rodaTime;
      updateTimer();
      updateModel(isOffensive ? "offensive" : "defensive", true);

      state.rodaInterval = setInterval(() => {
        state.timeLeft--;
        updateTimer();

        if (state.timeLeft <= 0) {
          // Check for untouchable achievement (no hits this round)
          if (combatFeedback.hitCount === 0 && combatFeedback.blockCount > 0) {
            gameScore.unlockAchievement('noHits');
          }

          isOffensive = !isOffensive;
          state.timeLeft = rodaTime;
          updateModel(isOffensive ? "offensive" : "defensive", true);
        }
      }, 1000);
    }

    function stopRodaSequence() {
      clearInterval(state.rodaInterval);
      state.rodaInterval = null;
      state.currentDefensiveIndex = DEFENSIVE_START_INDEX;
      state.currentOffensiveIndex = OFFENSIVE_START_INDEX;
      updateModel("defensive", false);
    }

    function toggleRodaMode() {
      if (!state.isGameStarted || state.showingSummary) return;

      state.isRodaModeActive = !state.isRodaModeActive;

      // Show/hide timer panel
      if (timerPanel) timerPanel.setAttribute('visible', state.isRodaModeActive);

      // Update mode indicator
      if (modeText) {
        modeText.setAttribute('text', 'value', state.isRodaModeActive ? 'RODA MODE' : 'TRAINING');
        modeText.setAttribute('text', 'color', state.isRodaModeActive ? '#ffd93d' : '#00d4ff');
      }

      pulse('left', 0.4, 60);

      if (state.isRodaModeActive) {
        hud.coach('Roda mode — block the attacks!', '#ffd93d');
        startRodaSequence();
      } else {
        hud.coach('Training mode', '#00d4ff', 2000);
        stopRodaSequence();
      }
    }

    // Reactive sparring: the opponent-ai component drives the opponent, facing
    // and attacking the player based on distance/guard. Mutually exclusive with
    // roda (which is a fixed timed sequence).
    function toggleSparMode() {
      if (!state.isGameStarted || state.showingSummary) return;

      // Leaving roda if it was on.
      if (!state.isSparMode && state.isRodaModeActive) {
        state.isRodaModeActive = false;
        if (timerPanel) timerPanel.setAttribute('visible', false);
        stopRodaSequence();
      }

      state.isSparMode = !state.isSparMode;
      if (!state.isSparMode) recenterOpponent();

      if (modeText) {
        modeText.setAttribute('text', 'value', state.isSparMode ? 'SPAR MODE' : 'TRAINING');
        modeText.setAttribute('text', 'color', state.isSparMode ? '#ff6b6b' : '#00d4ff');
      }
      pulse('left', 0.5, 80);
      hud.coach(
        state.isSparMode
          ? 'Spar mode — it reads your guard!'
          : 'Training mode',
        state.isSparMode ? '#ff8f8f' : '#00d4ff',
        state.isSparMode ? COACH_MS : 2000
      );
    }

    // --- INPUT HANDLERS ---

    // Short confirmation buzz so every binding has a felt response, including
    // the ones whose effect isn't immediately visible (mode toggles).
    function pulse(hand, intensity = 0.4, duration = 50) {
      if (hand === 'both') combatFeedback.triggerBothHaptics(intensity, duration);
      else combatFeedback.triggerHaptics(hand, intensity, duration);
    }

    function handleGripDown() {
      if (!state.isGameStarted || state.showingSummary) return;
      entity.setAttribute("clip-player", "timeScale", SLOW_MOTION_SCALE);
      hud.coach('Slow motion', '#6bcb77', 0);
    }

    function handleGripUp() {
      if (!state.isGameStarted || state.showingSummary) return;
      // Restore to difficulty-based speed
      const diff = DIFFICULTY[gameData.currentDifficulty];
      entity.setAttribute("clip-player", "timeScale", diff.animationSpeed);
      hud.clearCoach();
    }

    // Turning the opponent is a study aid, so allow it on the welcome screen
    // too — that's where you're first looking the model over.
    function handleTriggerDown() {
      if (state.showingSummary) return;
      // In Spar mode opponent-ai owns the facing and would overwrite this on the
      // next frame, so say why instead of looking like a dead button.
      if (state.isSparMode) {
        hud.coach('It turns to face you in Spar', '#ff8f8f', 2500);
        return;
      }
      state.isFacingAway = !state.isFacingAway;
      const yRotation = state.isFacingAway ? FACING_AWAY_ROTATION : DEFAULT_MODEL_ROTATION;
      entity.setAttribute("rotation", `0 ${yRotation} 0`);
    }

    // "Confirm": start a session, or dismiss the summary.
    function handleConfirm() {
      if (state.showingSummary) {
        gameScore.hideSummary();
        resetToWelcome();
      } else if (!state.isGameStarted) {
        startGame();
      }
    }

    function nextOffensive() {
      if (!state.isGameStarted || state.showingSummary) return;
      // Roda and Spar drive the opponent themselves; stepping moves by hand
      // there would fight the mode instead of doing nothing visible.
      if (state.isRodaModeActive || state.isSparMode) {
        hud.coach('Manual moves off in Roda/Spar', '#ff8f8f', 2500);
        return;
      }
      updateModel('offensive');
      pulse('right', 0.3, 40);
    }

    function nextDefensive() {
      if (!state.isGameStarted || state.showingSummary) return;
      if (state.isRodaModeActive || state.isSparMode) {
        hud.coach('Manual moves off in Roda/Spar', '#ff8f8f', 2500);
        return;
      }
      updateModel('defensive');
      pulse('right', 0.3, 40);
    }

    // --- EVENT LISTENERS ---
    //
    // Quest 2 hardware only reports X/Y on the LEFT controller and A/B on the
    // RIGHT one (A-Frame's meta-touch-controls button maps say so outright), so
    // a handler bound to e.g. "abuttondown" on the left hand can never fire.
    // Bindings below stay on the hand that physically owns each button:
    //
    //   LEFT   X  Roda mode          (menu: cycle difficulty)
    //          Y  Spar mode
    //   RIGHT  A  next attack        (menu: start / summary: continue)
    //          B  next defence, hold to end session  (menu: start)
    //   BOTH   trigger  turn opponent      grip hold  slow motion
    //          thumbstick press  controls card
    //          thumbstick left/right  difficulty (menu only)

    // Hold-to-end guard: a tap on B steps the defensive move, holding it ends
    // the session. Ending on a bare press was too easy to trigger by accident.
    let endHoldTimer = null;
    let endHoldPromptTimer = null;
    let endHoldPrompted = false;

    function beginEndHold() {
      if (!state.isGameStarted || state.showingSummary) return;
      cancelEndHold();
      endHoldPromptTimer = setTimeout(() => {
        endHoldPromptTimer = null;
        endHoldPrompted = true;
        hud.coach('Hold [B] to end the session', '#ff8f8f', 0);
      }, 250);
      endHoldTimer = setTimeout(() => {
        endHoldTimer = null;
        endHoldPrompted = false;
        pulse('both', 0.8, 120);
        hud.clearCoach();
        endSession();
      }, END_SESSION_HOLD_MS);
    }

    function cancelEndHold() {
      if (endHoldPromptTimer) clearTimeout(endHoldPromptTimer);
      if (endHoldTimer) clearTimeout(endHoldTimer);
      endHoldPromptTimer = null;
      endHoldTimer = null;
      // Only wipe the prompt if we actually put it up and the hold didn't land.
      if (endHoldPrompted) {
        endHoldPrompted = false;
        hud.clearCoach();
      }
    }

    function attachControllerEvents(controller) {
      const isLeft = controller.id === 'leftHand';

      // Shared on both hands, so neither hand is the "wrong" one to reach for.
      controller.addEventListener("gripdown", handleGripDown);
      controller.addEventListener("gripup", handleGripUp);
      controller.addEventListener("triggerdown", handleTriggerDown);
      controller.addEventListener("thumbstickdown", toggleControlsCard);

      // Thumbstick nudges pick the difficulty on the welcome screen.
      let stickLatched = false;
      controller.addEventListener("thumbstickmoved", (e) => {
        if (state.isGameStarted || state.showingSummary) return;
        const x = e.detail && e.detail.x;
        if (typeof x !== 'number') return;
        if (Math.abs(x) < STICK_DEADZONE) { stickLatched = false; return; }
        if (stickLatched) return;          // one step per deflection
        stickLatched = true;
        stepDifficulty(x > 0 ? 1 : -1);
      });

      if (isLeft) {
        // X - Roda mode in session, difficulty cycling on the menu.
        controller.addEventListener("xbuttondown", () => {
          if (state.showingSummary) return;
          if (state.isGameStarted) toggleRodaMode();
          else cycleDifficulty();
        });

        // Y - Spar mode (reactive opponent).
        controller.addEventListener("ybuttondown", () => {
          if (state.isGameStarted && !state.showingSummary) toggleSparMode();
        });
      } else {
        // A - confirm on the menus, next attack in session.
        controller.addEventListener("abuttondown", () => {
          if (state.isGameStarted && !state.showingSummary) nextOffensive();
          else handleConfirm();
        });

        // B - next defence on tap, end session on hold. Also starts a session
        // from the menu, so the older "press B to start" habit still works.
        controller.addEventListener("bbuttondown", () => {
          if (!state.isGameStarted || state.showingSummary) { handleConfirm(); return; }
          nextDefensive();
          beginEndHold();
        });
        controller.addEventListener("bbuttonup", cancelEndHold);
      }
    }

    if (leftHand) attachControllerEvents(leftHand);
    if (rightHand) attachControllerEvents(rightHand);

    // Cleanup on page unload to prevent memory leaks
    window.addEventListener('beforeunload', () => {
      if (state.rodaInterval) {
        clearInterval(state.rodaInterval);
        state.rodaInterval = null;
      }
      cancelEndHold();
      combatFeedback.cleanup();
      gameScore.cleanup();
      hud.cleanup();
      gameData.save();
    });

