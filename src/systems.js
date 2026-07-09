/* global AFRAME, THREE */
// systems.js — extracted from index.html (slice 2 de-monolith).
// Loaded as an ORDERED classic script at end of <body>: config.js -> systems.js
// -> game.js. Classic scripts share one global lexical scope and run in order,
// so top-level const/let/function bindings are visible across the three files.
// gameData, gameScore, combatFeedback + components (follow-camera-y/follow-camera/hit-detect) + showContactHUD.

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

      load: function () {
        try {
          const saved = localStorage.getItem('capoeiraVRData');
          if (saved) {
            const data = JSON.parse(saved);
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

        if (comboBg && this.combo >= 3) {
          comboBg.setAttribute('color', this.combo >= 10 ? '#ffd93d' : this.combo >= 5 ? '#6bcb77' : '#1a1a2e');
          comboBg.setAttribute('opacity', this.combo >= 5 ? '0.95' : '0.85');
        } else if (comboBg) {
          comboBg.setAttribute('color', '#1a1a2e');
          comboBg.setAttribute('opacity', '0.85');
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
        const panels = [moveTitlePanel, instructionPanel, statsPanel, modePanel, combatFeedbackPanel, scorePanel, comboPanel, levelPanel, timerPanel];
        panels.forEach(p => p && p.setAttribute('visible', false));

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

    // --- A-FRAME COMPONENTS ---

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

      triggerScreenFlash: function (color = 'red', duration = 150) {
        if (!this.screenFlash) return;

        if (this.flashTimeout) clearTimeout(this.flashTimeout);

        this.screenFlash.setAttribute('material', 'color', color);
        this.screenFlash.setAttribute('material', 'opacity', 0.6);

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

        this.iconTimeout = setTimeout(() => {
          statusIcon.setAttribute('material', 'color', '#00d4ff');
        }, 1500);
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

      updateText: function (message, color) {
        const collisionText = document.getElementById('collisionText');
        if (!collisionText) return;

        if (this.textTimeout) clearTimeout(this.textTimeout);

        collisionText.setAttribute('text', 'value', message);
        collisionText.setAttribute('text', 'color', color);

        this.textTimeout = setTimeout(() => {
          collisionText.setAttribute('text', 'value', 'Ready');
          collisionText.setAttribute('text', 'color', '#00d4ff');
        }, 2000);
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

    // Contact/collision HUD
    const CONTACT_HUD_DURATION_MS = 800;
    const CONTACT_HUD_COOLDOWN_MS = 120;
    let _contactHudTimer = null;
    let _lastContactHudAt = 0;

    function showContactHUD() {
      const now = Date.now();
      if (now - _lastContactHudAt < CONTACT_HUD_COOLDOWN_MS) return;
      _lastContactHudAt = now;

      const el = document.getElementById('contactText');
      if (!el) return;

      el.setAttribute('text', 'value', "CONTACT!");
      el.setAttribute('visible', true);

      if (_contactHudTimer) clearTimeout(_contactHudTimer);
      _contactHudTimer = setTimeout(() => {
        el.setAttribute('visible', false);
        el.setAttribute('text', 'value', '');
      }, CONTACT_HUD_DURATION_MS);
    }

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
        showContactHUD();
        this.el.emit('opponent-contact', { attacker, target: part });
      },

      remove: function () {
        this.el.removeEventListener('model-loaded', this._collectBones);
      }
    });

