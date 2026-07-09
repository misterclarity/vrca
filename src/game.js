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

      // Show game UI panels
      if (moveTitlePanel) moveTitlePanel.setAttribute('visible', true);
      if (instructionPanel) instructionPanel.setAttribute('visible', true);
      if (statsPanel) statsPanel.setAttribute('visible', true);
      if (modePanel) modePanel.setAttribute('visible', true);
      if (combatFeedbackPanel) combatFeedbackPanel.setAttribute('visible', true);
      if (scorePanel) scorePanel.setAttribute('visible', true);
      if (comboPanel) comboPanel.setAttribute('visible', true);
      if (levelPanel) levelPanel.setAttribute('visible', true);

      // Update instruction text
      if (instructionText) {
        instructionText.setAttribute('text', 'value', 'Press joystick for help');
      }

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
    }

    function endSession() {
      if (!state.isGameStarted) return;

      // Stop any active modes
      if (state.isRodaModeActive) {
        clearInterval(state.rodaInterval);
        state.rodaInterval = null;
        state.isRodaModeActive = false;
      }

      // Calculate and save session results
      gameScore.endSession();

      // Show summary
      gameScore.showSummary();
    }

    function resetToWelcome() {
      state.isGameStarted = false;
      state.isRodaModeActive = false;
      state.isChallengeMode = false;
      state.showingSummary = false;
      state.currentDefensiveIndex = DEFENSIVE_START_INDEX;
      state.currentOffensiveIndex = OFFENSIVE_START_INDEX;

      // Hide all game panels
      const panels = [moveTitlePanel, instructionPanel, statsPanel, modePanel, combatFeedbackPanel, scorePanel, comboPanel, levelPanel, timerPanel, summaryScreen, helpScreen];
      panels.forEach(p => p && p.setAttribute('visible', false));

      // Update and show welcome screen
      gameData.updateWelcomeScreen();
      welcomeScreen.setAttribute('visible', true);
    }

    function toggleHelpScreen() {
      if (!state.isGameStarted || state.showingSummary) return;
      state.isHelpVisible = !state.isHelpVisible;
      helpScreen.setAttribute("visible", state.isHelpVisible);

      // Hide/show other panels when help is visible
      const panels = [moveTitlePanel, instructionPanel, statsPanel, modePanel, combatFeedbackPanel, scorePanel, comboPanel, levelPanel];
      panels.forEach(p => p && p.setAttribute('visible', !state.isHelpVisible));
      if (timerPanel && state.isRodaModeActive) timerPanel.setAttribute('visible', !state.isHelpVisible);
    }

    function setDifficulty(diff) {
      if (state.isGameStarted) return; // Can't change during game
      gameData.setDifficulty(diff);
    }

    // --- MODEL UPDATE FUNCTIONS ---

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

      // Update instruction based on move type
      if (instructionText) {
        instructionText.setAttribute(
          'text',
          'value',
          moveType === 'offensive' ? 'Dodge or block this attack!' : 'Study this defensive move'
        );
      }

      const yRotation = state.isFacingAway ? FACING_AWAY_ROTATION : DEFAULT_MODEL_ROTATION;
      entity.setAttribute("rotation", `0 ${yRotation} 0`);
    }

    // Set initial model for display on the welcome screen
    updateModel(state.currentMoveType);

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

      if (state.isRodaModeActive) {
        if (instructionText) {
          instructionText.setAttribute('text', 'value', 'Block the attacks!');
        }
        startRodaSequence();
      } else {
        if (instructionText) {
          instructionText.setAttribute('text', 'value', 'Training mode');
        }
        stopRodaSequence();
      }
    }

    // --- INPUT HANDLERS ---

    function handleGripDown() {
      if (!state.isGameStarted || state.showingSummary) return;
      entity.setAttribute("clip-player", "timeScale", SLOW_MOTION_SCALE);
    }

    function handleGripUp() {
      if (!state.isGameStarted || state.showingSummary) return;
      // Restore to difficulty-based speed
      const diff = DIFFICULTY[gameData.currentDifficulty];
      entity.setAttribute("clip-player", "timeScale", diff.animationSpeed);
    }

    function handleTriggerDown() {
      if (!state.isGameStarted || state.showingSummary) return;
      state.isFacingAway = !state.isFacingAway;
      const yRotation = state.isFacingAway ? FACING_AWAY_ROTATION : DEFAULT_MODEL_ROTATION;
      entity.setAttribute("rotation", `0 ${yRotation} 0`);
    }

    // --- EVENT LISTENERS ---

    function attachControllerEvents(controller) {
      controller.addEventListener("gripdown", handleGripDown);
      controller.addEventListener("gripup", handleGripUp);
      controller.addEventListener("triggerdown", handleTriggerDown);
      controller.addEventListener("thumbstickdown", toggleHelpScreen);

      if (controller.id === "leftHand") {
        // A button - Offensive move (in game) or Easy difficulty (menu)
        controller.addEventListener("abuttondown", () => {
          if (!state.isGameStarted && !state.showingSummary) {
            setDifficulty('easy');
          } else if (state.isGameStarted && !state.isRodaModeActive && !state.showingSummary) {
            updateModel("offensive");
          }
        });

        // B button - Defensive move (in game) or end session (in game)
        controller.addEventListener("bbuttondown", () => {
          if (state.isGameStarted && !state.showingSummary) {
            if (state.isRodaModeActive) {
              endSession(); // End session when in Roda mode
            } else {
              updateModel("defensive");
            }
          }
        });

        // X button - Roda mode (in game) or Normal difficulty (menu)
        controller.addEventListener("xbuttondown", () => {
          if (!state.isGameStarted && !state.showingSummary) {
            setDifficulty('normal');
          } else {
            toggleRodaMode();
          }
        });

        // Y button - Hard difficulty (menu only)
        controller.addEventListener("ybuttondown", () => {
          if (!state.isGameStarted && !state.showingSummary) {
            setDifficulty('hard');
          }
        });
      } else if (controller.id === "rightHand") {
        // A button - Roda mode toggle
        controller.addEventListener("abuttondown", () => {
          if (state.isGameStarted && !state.showingSummary) {
            toggleRodaMode();
          }
        });

        // B button - Start game / Continue from summary
        controller.addEventListener("bbuttondown", () => {
          if (state.showingSummary) {
            gameScore.hideSummary();
            resetToWelcome();
          } else {
            startGame();
          }
        });

        // Y button - End session (in game)
        controller.addEventListener("ybuttondown", () => {
          if (state.isGameStarted && !state.showingSummary) {
            endSession();
          }
        });
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
      combatFeedback.cleanup();
      gameScore.cleanup();
      gameData.save();
    });

