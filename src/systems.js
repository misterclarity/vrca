/* global AFRAME, THREE */
// systems.js — extracted from index.html (slice 2 de-monolith).
// Loaded as an ORDERED classic script at end of <body>: config.js -> systems.js
// -> game.js. Classic scripts share one global lexical scope and run in order,
// so top-level const/let/function bindings are visible across the three files.
// gameData, gameScore, hud, combatFeedback + components
// (follow-camera-y/follow-camera/billboard-to-camera/hit-detect).

    // --- GAME DATA SYSTEM (localStorage) ---
    const gameData = {
      currentDifficulty: 'normal',
      totalXP: 0,
      currentLevel: 1,
      highScore: 0,
      totalBlocks: 0,
      totalHits: 0,
      totalSessions: 0,
      bestComboEver: 0,
      achievements: {},

      seenOnboarding: false,

      load: function () {
        try {
          const saved = localStorage.getItem('capoeiraVRData');
          if (saved) {
            const data = JSON.parse(saved);
            this.seenOnboarding = !!data.seenOnboarding;
            this.totalXP = data.totalXP || 0;
            this.currentLevel = data.currentLevel || 1;
            this.highScore = data.highScore || 0;
            this.totalBlocks = data.totalBlocks || 0;
            this.totalHits = data.totalHits || 0;
            this.totalSessions = data.totalSessions || 0;
            this.bestComboEver = data.bestComboEver || 0;
            this.achievements = data.achievements || {};
            this.currentDifficulty = data.currentDifficulty || 'normal';
          }
        } catch (e) {
          console.warn('Could not load game data:', e);
        }
        this.updateWelcomeScreen();
      },

      save: function () {
        try {
          localStorage.setItem('capoeiraVRData', JSON.stringify({
            seenOnboarding: this.seenOnboarding,
            totalXP: this.totalXP,
            currentLevel: this.currentLevel,
            highScore: this.highScore,
            totalBlocks: this.totalBlocks,
            totalHits: this.totalHits,
            totalSessions: this.totalSessions,
            bestComboEver: this.bestComboEver,
            achievements: this.achievements,
            currentDifficulty: this.currentDifficulty
          }));
        } catch (e) {
          console.warn('Could not save game data:', e);
        }
      },

      addXP: function (amount) {
        const multiplier = DIFFICULTY[this.currentDifficulty].xpMultiplier;
        const xpGained = Math.floor(amount * multiplier);
        this.totalXP += xpGained;

        // Check for level up
        const newLevel = this.calculateLevel();
        if (newLevel > this.currentLevel) {
          this.currentLevel = newLevel;
          this.onLevelUp(newLevel);
        }

        this.save();
        return xpGained;
      },

      calculateLevel: function () {
        for (let i = LEVELS.length - 1; i >= 0; i--) {
          if (this.totalXP >= LEVELS[i].xpRequired) {
            return LEVELS[i].level;
          }
        }
        return 1;
      },

      getLevelInfo: function () {
        const current = LEVELS[this.currentLevel - 1];
        const next = LEVELS[this.currentLevel] || current;
        const xpForNext = next.xpRequired - (LEVELS[this.currentLevel - 1]?.xpRequired || 0);
        const xpProgress = this.totalXP - (current?.xpRequired || 0);
        return { current, next, xpForNext, xpProgress };
      },

      onLevelUp: function (newLevel) {
        const levelInfo = LEVELS[newLevel - 1];
        gameScore.showAchievement(`LEVEL UP! ${levelInfo.name}`);

        // Check level achievements
        if (newLevel >= 5) gameScore.unlockAchievement('level5');
      },

      setDifficulty: function (diff) {
        this.currentDifficulty = diff;
        this.save();
        this.updateDifficultyUI();
      },

      updateDifficultyUI: function () {
        // Update welcome screen difficulty buttons
        const difficulties = ['easy', 'normal', 'hard'];
        difficulties.forEach(d => {
          const el = document.getElementById(`diff${d.charAt(0).toUpperCase() + d.slice(1)}`);
          if (el) {
            const bg = el.querySelector('a-rounded');
            if (bg) {
              if (d === this.currentDifficulty) {
                bg.setAttribute('color', d === 'easy' ? '#6bcb77' : d === 'normal' ? '#ffd93d' : '#ff6b6b');
                bg.setAttribute('opacity', '1');
              } else {
                bg.setAttribute('color', '#1a1a2e');
                bg.setAttribute('opacity', '0.9');
              }
            }
          }
        });

        // Update in-game difficulty text
        if (difficultyText) {
          difficultyText.setAttribute('text', 'value', DIFFICULTY[this.currentDifficulty].name);
        }
      },

      updateWelcomeScreen: function () {
        const levelInfo = this.getLevelInfo();

        if (welcomeLevelText) {
          welcomeLevelText.setAttribute('text', 'value', `Level ${this.currentLevel} - ${levelInfo.current.name}`);
          welcomeLevelText.setAttribute('text', 'color', levelInfo.current.color);
        }
        if (welcomeXPText) {
          welcomeXPText.setAttribute('text', 'value', `${levelInfo.xpProgress}/${levelInfo.xpForNext} XP to next level`);
        }
        if (welcomeHighScore) {
          welcomeHighScore.setAttribute('text', 'value', this.highScore.toString());
        }

        this.updateDifficultyUI();
      }
    };

    // --- SCORING SYSTEM ---
    const gameScore = {
      score: 0,
      combo: 0,
      bestCombo: 0,
      sessionXP: 0,
      comboTimeout: null,
      achievementTimeout: null,

      reset: function () {
        this.score = 0;
        this.combo = 0;
        this.bestCombo = 0;
        this.sessionXP = 0;
        this.updateUI();
      },

      addBlock: function () {
        const diff = DIFFICULTY[gameData.currentDifficulty];
        this.combo++;

        // Calculate points with combo multiplier
        const comboMultiplier = Math.min(this.combo, 10); // Cap at 10x
        const points = diff.blockPoints + (diff.comboBonus * (comboMultiplier - 1));
        this.score += points;

        // Track best combo
        if (this.combo > this.bestCombo) {
          this.bestCombo = this.combo;
        }
        if (this.combo > gameData.bestComboEver) {
          gameData.bestComboEver = this.combo;
        }

        // Reset combo timeout
        if (this.comboTimeout) clearTimeout(this.comboTimeout);
        this.comboTimeout = setTimeout(() => this.resetCombo(), 5000);

        // Check achievements
        if (this.combo === 1) this.unlockAchievement('firstBlock');
        if (this.combo === 5) this.unlockAchievement('combo5');
        if (this.combo === 10) this.unlockAchievement('combo10');
        if (combatFeedback.blockCount === 10) this.unlockAchievement('blocks10');
        if (combatFeedback.blockCount === 25) this.unlockAchievement('blocks25');
        if (this.score >= 500) this.unlockAchievement('score500');
        if (this.score >= 1000) this.unlockAchievement('score1000');

        this.updateUI();
        return points;
      },

      addHit: function () {
        const diff = DIFFICULTY[gameData.currentDifficulty];
        this.score = Math.max(0, this.score - diff.hitPenalty);
        this.resetCombo();
        this.updateUI();
      },

      resetCombo: function () {
        this.combo = 0;
        if (this.comboTimeout) {
          clearTimeout(this.comboTimeout);
          this.comboTimeout = null;
        }
        this.updateUI();
      },

      updateUI: function () {
        if (scoreText) scoreText.setAttribute('text', 'value', this.score.toString());

        if (comboText) {
          comboText.setAttribute('text', 'value', `${this.combo}x`);
          // Change color based on combo
          let color = '#00d4ff';
          if (this.combo >= 10) color = '#ffd93d';
          else if (this.combo >= 5) color = '#6bcb77';
          else if (this.combo >= 3) color = '#00d4ff';
          comboText.setAttribute('text', 'color', color);
        }

        // The combo pill only appears once a combo is worth noticing; below
        // that it stays fully transparent instead of drawing an empty box.
        if (comboBg && this.combo >= 3) {
          comboBg.setAttribute('color', this.combo >= 10 ? '#ffd93d' : this.combo >= 5 ? '#6bcb77' : '#00d4ff');
          comboBg.setAttribute('opacity', this.combo >= 5 ? '0.5' : '0.3');
        } else if (comboBg) {
          comboBg.setAttribute('opacity', '0');
        }

        if (bestComboText) bestComboText.setAttribute('text', 'value', `Best: ${this.bestCombo}x`);

        // Update level panel
        const levelInfo = gameData.getLevelInfo();
        if (levelText) levelText.setAttribute('text', 'value', `Lv.${gameData.currentLevel}`);
        if (xpText) xpText.setAttribute('text', 'value', `${levelInfo.xpProgress}/${levelInfo.xpForNext} XP`);
      },

      unlockAchievement: function (id) {
        if (gameData.achievements[id]) return; // Already unlocked

        const achievement = ACHIEVEMENTS[id];
        if (!achievement) return;

        gameData.achievements[id] = true;
        gameData.save();

        this.showAchievement(achievement.name);
      },

      showAchievement: function (text) {
        if (!achievementPanel || !achievementText) return;

        if (this.achievementTimeout) clearTimeout(this.achievementTimeout);

        achievementText.setAttribute('text', 'value', text);
        achievementPanel.setAttribute('visible', true);

        this.achievementTimeout = setTimeout(() => {
          achievementPanel.setAttribute('visible', false);
        }, 3000);
      },

      endSession: function () {
        // Calculate XP based on performance
        const baseXP = Math.floor(this.score / 10);
        const comboBonus = this.bestCombo * 2;
        const blockBonus = combatFeedback.blockCount * 3;
        const hitPenalty = combatFeedback.hitCount * 2;

        this.sessionXP = Math.max(0, baseXP + comboBonus + blockBonus - hitPenalty);

        // Update high score
        if (this.score > gameData.highScore) {
          gameData.highScore = this.score;
        }

        // Update totals
        gameData.totalBlocks += combatFeedback.blockCount;
        gameData.totalHits += combatFeedback.hitCount;
        gameData.totalSessions++;

        // Add XP
        const xpGained = gameData.addXP(this.sessionXP);

        // Check hard mode achievement
        if (gameData.currentDifficulty === 'hard' && combatFeedback.blockCount > 0) {
          this.unlockAchievement('hardMode');
        }

        gameData.save();
        return { xpGained, sessionXP: this.sessionXP };
      },

      showSummary: function () {
        state.showingSummary = true;

        // Hide game UI
        hud.stopOnboarding();
        hud.clearCoach();
        hud.hideControls();
        hud.showGamePanels(false);
        if (timerPanel) timerPanel.setAttribute('visible', false);

        // Update summary screen
        const summaryScore = document.getElementById('summaryScore');
        const summaryBlocks = document.getElementById('summaryBlocks');
        const summaryBestCombo = document.getElementById('summaryBestCombo');
        const summaryHits = document.getElementById('summaryHits');
        const summaryXP = document.getElementById('summaryXP');
        const summaryLevel = document.getElementById('summaryLevel');

        if (summaryScore) summaryScore.setAttribute('text', 'value', this.score.toString());
        if (summaryBlocks) summaryBlocks.setAttribute('text', 'value', combatFeedback.blockCount.toString());
        if (summaryBestCombo) summaryBestCombo.setAttribute('text', 'value', `${this.bestCombo}x`);
        if (summaryHits) summaryHits.setAttribute('text', 'value', combatFeedback.hitCount.toString());
        if (summaryXP) summaryXP.setAttribute('text', 'value', `+${this.sessionXP} XP`);

        const levelInfo = gameData.getLevelInfo();
        if (summaryLevel) summaryLevel.setAttribute('text', 'value', `Level ${gameData.currentLevel} - ${levelInfo.current.name}`);

        summaryScreen.setAttribute('visible', true);
      },

      hideSummary: function () {
        state.showingSummary = false;
        summaryScreen.setAttribute('visible', false);
      },

      cleanup: function () {
        if (this.comboTimeout) clearTimeout(this.comboTimeout);
        if (this.achievementTimeout) clearTimeout(this.achievementTimeout);
      }
    };

    // Load saved game data on start
    gameData.load();

    // New gamification elements
    const scorePanel = document.getElementById("scorePanel");
    const scoreText = document.getElementById("scoreText");
    const comboPanel = document.getElementById("comboPanel");
    const comboText = document.getElementById("comboText");
    const comboBg = document.getElementById("comboBg");
    const levelPanel = document.getElementById("levelPanel");
    const levelText = document.getElementById("levelText");
    const xpText = document.getElementById("xpText");
    const achievementPanel = document.getElementById("achievementPanel");
    const achievementText = document.getElementById("achievementText");
    const summaryScreen = document.getElementById("summaryScreen");

    // --- HUD / COACHING LAYER ---------------------------------------------
    // One rule drives everything here: nothing stays on screen that isn't
    // currently telling the player something. Readouts sit at the edges of the
    // view, hints self-dismiss, and the full control reference rides on the
    // player's wrist instead of a modal that blanks out the rest of the HUD.
    const CARD_W = 0.32;
    const CARD_ROW_H = 0.034;
    const CARD_TITLE_H = 0.055;
    const CARD_FOOTER_H = 0.045;

    const hud = {
      coachTimeout: null,
      controlsTimeout: null,
      onboardingTimeout: null,
      builtFor: null,          // cache key so the card is only rebuilt on change

      isVR: function () {
        const scene = document.querySelector('a-scene');
        return !!(scene && scene.is('vr-mode'));
      },

      // Which control set applies right now.
      context: function () {
        return (state.isGameStarted && !state.showingSummary) ? 'session' : 'menu';
      },

      // --- coach line: one short, self-dismissing hint low in the view ---
      // Replaces the old permanently-parked "Press joystick for help" strip.
      coach: function (message, color, ms) {
        if (!instructionPanel || !instructionText) return;
        if (this.coachTimeout) clearTimeout(this.coachTimeout);
        instructionText.setAttribute('text', 'value', message);
        instructionText.setAttribute('text', 'color', color || '#9fb3c8');
        instructionPanel.setAttribute('visible', true);

        const life = ms === undefined ? COACH_MS : ms;
        if (life <= 0) { this.coachTimeout = null; return; }  // 0 = pin it
        this.coachTimeout = setTimeout(() => {
          instructionPanel.setAttribute('visible', false);
          this.coachTimeout = null;
        }, life);
      },

      clearCoach: function () {
        if (this.coachTimeout) clearTimeout(this.coachTimeout);
        this.coachTimeout = null;
        if (instructionPanel) instructionPanel.setAttribute('visible', false);
      },

      // --- wrist controls card ---
      // Rows are generated from CONTROLS so the reference can never drift from
      // the actual bindings, and Quest vs keyboard labels are picked per device.
      buildControls: function () {
        if (!controlsCardRows) return;
        const mode = this.isVR() ? 'vr' : 'desktop';
        const ctx = this.context();
        const key = ctx + ':' + mode;
        if (this.builtFor === key) return;
        this.builtFor = key;

        const rows = CONTROLS[ctx][mode];
        const h = CARD_TITLE_H + rows.length * CARD_ROW_H + CARD_FOOTER_H;

        while (controlsCardRows.firstChild) {
          controlsCardRows.removeChild(controlsCardRows.firstChild);
        }

        rows.forEach(([button, action], i) => {
          const y = h / 2 - CARD_TITLE_H - (i + 0.5) * CARD_ROW_H;

          const keyEl = document.createElement('a-entity');
          keyEl.setAttribute('position', `${-CARD_W / 2 + 0.015} ${y} 0`);
          keyEl.setAttribute('text', {
            value: button, align: 'left', anchor: 'left', width: 0.14,
            wrapCount: 15, color: '#ffd93d', font: 'mozillavr'
          });
          controlsCardRows.appendChild(keyEl);

          const actionEl = document.createElement('a-entity');
          actionEl.setAttribute('position', `-0.045 ${y} 0`);
          actionEl.setAttribute('text', {
            value: action, align: 'left', anchor: 'left', width: 0.155,
            wrapCount: 16, color: '#e6eef7', font: 'mozillavr'
          });
          controlsCardRows.appendChild(actionEl);
        });

        if (controlsCardBg) {
          controlsCardBg.setAttribute('width', CARD_W);
          controlsCardBg.setAttribute('height', h);
          controlsCardBg.setAttribute('position', `${-CARD_W / 2} ${-h / 2} 0`);
        }
        if (controlsCardTitle) {
          controlsCardTitle.setAttribute('position', `0 ${h / 2 - 0.03} 0.002`);
          controlsCardTitle.setAttribute('text', 'value',
            ctx === 'session' ? 'CONTROLS' : 'CONTROLS - MENU');
        }
        if (controlsCardFooter) {
          controlsCardFooter.setAttribute('position', `0 ${-h / 2 + 0.022} 0.002`);
          controlsCardFooter.setAttribute('text', 'value', CONTROLS.dismiss[mode]);
        }
      },

      // The card rides ~0.4 m from the eye. In VR you raise your hand to it
      // deliberately; on desktop the guard hands are pinned in front of the
      // camera, where full size would swallow the screen — shrink it there.
      applyCardScale: function () {
        if (!controlsCard) return;
        const s = this.isVR() ? 1 : 0.5;
        controlsCard.setAttribute('scale', `${s} ${s} ${s}`);
      },

      showControls: function () {
        if (!controlsCard) return;
        this.buildControls();
        this.applyCardScale();
        controlsCard.setAttribute('visible', true);
        state.isHelpVisible = true;

        // Self-dismissing: a reference card left hanging in the view is exactly
        // the intrusiveness we're removing, so it times out on its own.
        if (this.controlsTimeout) clearTimeout(this.controlsTimeout);
        this.controlsTimeout = setTimeout(() => this.hideControls(), CONTROLS_CARD_MS);
      },

      hideControls: function () {
        if (this.controlsTimeout) clearTimeout(this.controlsTimeout);
        this.controlsTimeout = null;
        state.isHelpVisible = false;
        if (controlsCard) controlsCard.setAttribute('visible', false);
      },

      toggleControls: function () {
        if (state.isHelpVisible) this.hideControls();
        else this.showControls();
      },

      // --- first-run onboarding ---
      // Three one-line lessons, spaced out, shown once ever. This is what the
      // old wall-of-text help modal is replaced by for new players.
      startOnboarding: function () {
        if (gameData.seenOnboarding) return;
        state.onboardingStep = 0;
        this.nextOnboarding();
      },

      nextOnboarding: function () {
        this.onboardingTimeout = null;
        const lines = ONBOARDING[this.isVR() ? 'vr' : 'desktop'];
        if (state.onboardingStep >= lines.length) {
          gameData.seenOnboarding = true;
          gameData.save();
          return;
        }
        this.coach(lines[state.onboardingStep++], '#ffd93d', 5000);
        this.onboardingTimeout = setTimeout(() => this.nextOnboarding(), 5400);
      },

      stopOnboarding: function () {
        if (this.onboardingTimeout) clearTimeout(this.onboardingTimeout);
        this.onboardingTimeout = null;
      },

      // Show/hide the in-session readouts as one group.
      showGamePanels: function (on) {
        [topBar, moveTitlePanel, statsPanel, modePanel, combatFeedbackPanel]
          .forEach((p) => p && p.setAttribute('visible', on));
      },

      // Menu button prompts have to match the device actually in use.
      refreshPrompts: function () {
        const vr = this.isVR();
        if (welcomeStartHint) {
          welcomeStartHint.setAttribute('text', 'value',
            vr ? 'Press [A] to Start' : 'Press SPACE to Start');
        }
        if (welcomeDiffHint) {
          welcomeDiffHint.setAttribute('text', 'value',
            vr ? 'Thumbstick left / right to choose' : 'Press 1 / 2 / 3 to choose');
        }
        if (summaryContinueHint) {
          summaryContinueHint.setAttribute('text', 'value',
            vr ? '[A] Continue' : 'SPACE Continue');
        }
      },

      // Device swap invalidates every label we've rendered.
      onDeviceChange: function () {
        this.builtFor = null;
        this.refreshPrompts();
        this.applyCardScale();
        if (state.isHelpVisible) this.buildControls();
      },

      cleanup: function () {
        if (this.coachTimeout) clearTimeout(this.coachTimeout);
        if (this.controlsTimeout) clearTimeout(this.controlsTimeout);
        this.stopOnboarding();
      }
    };

    // Keep prompts/card honest across headset entry and exit.
    (function wireHudToDevice () {
      const scene = document.querySelector('a-scene');
      if (!scene) return;
      const sync = () => hud.onDeviceChange();
      scene.addEventListener('enter-vr', sync);
      scene.addEventListener('exit-vr', sync);
      if (scene.hasLoaded) hud.refreshPrompts();
      else scene.addEventListener('loaded', () => hud.refreshPrompts());
    })();

    // --- A-FRAME COMPONENTS ---

    // Turns a wrist-mounted panel to face the player, so the controls card is
    // readable whatever angle the controller is held at.
    //
    // It copies the camera's orientation rather than looking at the camera's
    // position: that keeps the card parallel to the view plane, so a card held
    // off to one side stays square instead of skewing into a trapezoid.
    AFRAME.registerComponent("billboard-to-camera", {
      init: function () {
        this.camera = document.getElementById('camera');
        this.camQuat = new THREE.Quaternion();
        this.parentQuat = new THREE.Quaternion();
      },
      tick: function () {
        if (!this.camera || !this.el.object3D.visible) return;
        this.camera.object3D.getWorldQuaternion(this.camQuat);
        const parent = this.el.object3D.parent;
        if (parent) {
          // Cancel the controller's own rotation so the card ignores wrist roll.
          parent.getWorldQuaternion(this.parentQuat);
          this.el.object3D.quaternion.copy(this.parentQuat.invert()).multiply(this.camQuat);
        } else {
          this.el.object3D.quaternion.copy(this.camQuat);
        }
      }
    });

    // Custom component for Y-axis rotation following
    AFRAME.registerComponent("follow-camera-y", {
      init: function () {
        this.cameraRig = document.getElementById("cameraRig");
      },
      tick: function () {
        if (!this.cameraRig) return;
        const cameraRigRotation = this.cameraRig.getAttribute("rotation");
        if (cameraRigRotation) {
          this.el.setAttribute("rotation", { x: 0, y: cameraRigRotation.y, z: 0 });
        }
      },
    });

    // Add the follow-camera-y component to the model container
    document.getElementById("modelContainer").setAttribute("follow-camera-y", "");

    // --- COMBAT FEEDBACK SYSTEM ---
    const combatFeedback = {
      hitCount: 0,
      blockCount: 0,
      lastHitTime: 0,
      screenFlash: null,
      flashTimeout: null,
      textTimeout: null,
      iconTimeout: null,

      get hitCooldown() {
        return DIFFICULTY[gameData.currentDifficulty].hitCooldown;
      },

      init: function () {
        this.screenFlash = document.getElementById('screenFlash');
      },

      reset: function () {
        this.hitCount = 0;
        this.blockCount = 0;
        this.lastHitTime = 0;
        this.updateStatsPanel();
      },

      // Kept subtle on purpose: a 60%-opaque full-view flash reads as a fault,
      // not as feedback. This is enough to register peripherally.
      triggerScreenFlash: function (color = 'red', duration = 150) {
        if (!this.screenFlash) return;

        if (this.flashTimeout) clearTimeout(this.flashTimeout);

        this.screenFlash.setAttribute('material', 'color', color);
        this.screenFlash.setAttribute('material', 'opacity', 0.3);

        this.flashTimeout = setTimeout(() => {
          this.screenFlash.setAttribute('material', 'opacity', 0);
        }, duration);
      },

      triggerHaptics: function (hand, intensity = 0.8, duration = 100) {
        const controller = hand === 'left' ? leftHand : rightHand;
        if (!controller || !controller.components['meta-touch-controls']) return;

        const gamepad = controller.components['meta-touch-controls'].controller;
        if (gamepad && gamepad.hapticActuators && gamepad.hapticActuators.length > 0) {
          gamepad.hapticActuators[0].pulse(intensity, duration);
        }
      },

      triggerBothHaptics: function (intensity = 1.0, duration = 150) {
        this.triggerHaptics('left', intensity, duration);
        this.triggerHaptics('right', intensity, duration);
      },

      updateStatsPanel: function () {
        if (hitsText) hitsText.setAttribute('text', 'value', `${this.hitCount} Hits`);
        if (blocksText) blocksText.setAttribute('text', 'value', `${this.blockCount} Blocks`);
      },

      updateStatusIcon: function (color) {
        if (!statusIcon) return;
        if (this.iconTimeout) clearTimeout(this.iconTimeout);

        statusIcon.setAttribute('material', 'color', color);
        statusIcon.setAttribute('material', 'opacity', 1);

        // Fade out with the text rather than sitting lit between exchanges.
        this.iconTimeout = setTimeout(() => {
          statusIcon.setAttribute('material', 'opacity', 0);
        }, 1400);
      },

      registerHit: function (attackerPart, targetPart) {
        const now = Date.now();
        if (now - this.lastHitTime < this.hitCooldown) return; // Prevent spam
        this.lastHitTime = now;

        this.hitCount++;

        // Update scoring
        gameScore.addHit();

        // Screen flash red - you got hit!
        this.triggerScreenFlash('red', 200);

        // Strong haptic on both controllers
        this.triggerBothHaptics(1.0, 200);

        // Update UI
        this.updateStatsPanel();
        this.updateStatusIcon('#ff6b6b');
        this.updateText(`HIT! -${DIFFICULTY[gameData.currentDifficulty].hitPenalty}`, '#ff6b6b');
      },

      registerBlock: function (attackerPart, blockerPart) {
        const now = Date.now();
        if (now - this.lastHitTime < this.hitCooldown) return;
        this.lastHitTime = now;

        this.blockCount++;

        // Update scoring
        const points = gameScore.addBlock();

        // Screen flash green - successful block!
        this.triggerScreenFlash('lime', 150);

        // Light haptic feedback
        this.triggerHaptics(blockerPart.includes('left') ? 'left' : 'right', 0.5, 100);

        // Update UI
        this.updateStatsPanel();
        this.updateStatusIcon('#6bcb77');

        // Show combo if active
        const comboText = gameScore.combo > 1 ? ` ${gameScore.combo}x COMBO!` : '';
        this.updateText(`+${points}${comboText}`, '#6bcb77');
      },

      registerPlayerStrike: function (playerPart, targetPart) {
        const now = Date.now();
        if (now - this.lastHitTime < this.hitCooldown) return;
        this.lastHitTime = now;

        // Screen flash blue - you landed a hit!
        this.triggerScreenFlash('cyan', 150);

        // Medium haptic
        this.triggerHaptics(playerPart.includes('left') ? 'left' : 'right', 0.6, 100);

        this.updateStatusIcon('#00d4ff');
        this.updateText(`NICE HIT!`, '#00d4ff');
      },

      // Combat feedback is transient text now — it clears completely instead of
      // idling on "Ready", so between exchanges the view in front of the
      // opponent is empty.
      updateText: function (message, color) {
        const collisionText = document.getElementById('collisionText');
        if (!collisionText) return;

        if (this.textTimeout) clearTimeout(this.textTimeout);

        collisionText.setAttribute('text', 'value', message);
        collisionText.setAttribute('text', 'color', color);

        this.textTimeout = setTimeout(() => {
          collisionText.setAttribute('text', 'value', '');
        }, 1400);
      },

      cleanup: function () {
        if (this.flashTimeout) clearTimeout(this.flashTimeout);
        if (this.textTimeout) clearTimeout(this.textTimeout);
        if (this.iconTimeout) clearTimeout(this.iconTimeout);
      }
    };

    // Initialize combat feedback after DOM is ready
    document.addEventListener('DOMContentLoaded', () => combatFeedback.init());
    // Also try immediate init in case DOM is already loaded
    if (document.readyState !== 'loading') combatFeedback.init();

    // --- PLAYER COLLIDER COMPONENT ---
    // Keeps an entity glued to the camera's world position (player head guard point).
    AFRAME.registerComponent("follow-camera", {
      init: function () {
        this.camera = document.getElementById('camera');
        this.worldPos = new THREE.Vector3();
      },
      tick: function () {
        if (!this.camera) return;
        this.camera.object3D.getWorldPosition(this.worldPos);
        this.el.object3D.position.copy(this.worldPos);
      }
    });

    // Combat collision WITHOUT a physics engine. Each frame, measure the distance
    // from the opponent's attacking limbs (feet/hands) to the player's guard points
    // (head = hit, hands = block). Bones are matched by regex so exports with
    // different node-index suffixes (mixamorigLeftFoot vs mixamorigLeftFoot63) work.
    AFRAME.registerComponent("hit-detect", {
      schema: {
        radius: { type: 'number', default: 0.3 },    // metres (forgiving block reach)
        cooldown: { type: 'number', default: 400 },   // ms per bone->target pair
      },
      init: function () {
        this.attackBones = [];   // { node, label }
        this.targets = [];       // { el, part }
        this.worldA = new THREE.Vector3();
        this.worldB = new THREE.Vector3();
        this.lastHit = {};

        const ATTACK = /LeftFoot|RightFoot|LeftHand|RightHand/;
        const SKIP = /Thumb|Index|Middle|Ring|Pinky|Toe|End/;
        const label = (n) =>
          /LeftFoot/.test(n) ? 'Left Kick' :
          /RightFoot/.test(n) ? 'Right Kick' :
          /LeftHand/.test(n) ? 'Left Punch' :
          /RightHand/.test(n) ? 'Right Punch' : n;

        this._collectBones = () => {
          const mesh = this.el.getObject3D('mesh');
          if (!mesh) return;
          this.attackBones = [];
          const seen = new Set();
          mesh.traverse((node) => {
            if (!node.isBone || !ATTACK.test(node.name) || SKIP.test(node.name)) return;
            const key = label(node.name);
            if (seen.has(key)) return;
            seen.add(key);
            this.attackBones.push({ node, label: key });
          });
          console.log('[hit-detect] attack bones:', this.attackBones.map((b) => b.label));
        };

        this._gatherTargets = () => {
          this.targets = ['playerHead', 'leftHand', 'rightHand']
            .map((id) => document.getElementById(id))
            .filter(Boolean)
            .map((el) => ({ el, part: el.getAttribute('data-body-part') }));
        };

        if (this.el.getObject3D('mesh')) this._collectBones();
        else this.el.addEventListener('model-loaded', this._collectBones);
        this._gatherTargets();
      },

      tick: function () {
        if (!this.attackBones.length) return;
        if (!this.targets.length) this._gatherTargets();
        // Only score during an active session.
        if (!state.isGameStarted || state.showingSummary) return;

        const now = Date.now();
        const r = this.data.radius;
        for (const b of this.attackBones) {
          b.node.getWorldPosition(this.worldA);
          for (const t of this.targets) {
            t.el.object3D.getWorldPosition(this.worldB);
            if (this.worldA.distanceTo(this.worldB) > r) continue;
            const key = b.label + '>' + t.part;
            if (now - (this.lastHit[key] || 0) < this.data.cooldown) continue;
            this.lastHit[key] = now;
            this._register(b.label, t.part);
          }
        }
      },

      _register: function (attacker, part) {
        if (part === 'head') {
          combatFeedback.registerHit(attacker, 'head');
        } else if (/Hand/i.test(part || '')) {
          combatFeedback.registerBlock(attacker, part);
        } else {
          combatFeedback.registerHit(attacker, part);
        }
        this.el.emit('opponent-contact', { attacker, target: part });
      },

      remove: function () {
        this.el.removeEventListener('model-loaded', this._collectBones);
      }
    });

