/* global AFRAME, THREE, state, DIFFICULTY, gameData */
// opponent-ai: makes the opponent seem to respond to the player. Active only in
// Spar mode (state.isSparMode). Each frame it faces the player and, on a varied
// cadence, picks a move from pools chosen by:
//   - distance  (far -> step-in entry; mid -> kick; close -> sweep)
//   - guard      (hands high -> attack low; hands low -> attack high)
//   - reaction   (just blocked -> flip level / feint)
// It drives the opponent through clip-player.playMove; scoring/contact is handled
// by the existing hit-detect + combatFeedback.

AFRAME.registerComponent('opponent-ai', {
  schema: {
    faceSpeed: { type: 'number', default: 4.0 },   // rad/s toward the player
    advance: { type: 'number', default: 0.6 },     // m/s when closing distance
    holdRange: { type: 'number', default: 1.8 },   // stop advancing at this range
    farRange: { type: 'number', default: 2.4 },
    closeRange: { type: 'number', default: 1.3 },
  },

  init: function () {
    this.player = document.getElementById('camera');
    this.leftHand = document.getElementById('leftHand');
    this.rightHand = document.getElementById('rightHand');
    this.ppos = new THREE.Vector3();
    this.mpos = new THREE.Vector3();
    this.hpos = new THREE.Vector3();
    this.nextAt = 0;
    this.flipLevel = false;   // set when the player blocks, to change level next
    this.wasActive = false;
    // Where the opponent started. tick() advances it toward the player during
    // Spar, so without this the opponent stays wherever it wandered to and the
    // next session begins with it off-centre or out of view entirely.
    this.home = this.el.object3D.position.clone();

    this.pools = {
      high: ['martelo', 'meia-lua-de-frente', 'meia-lua-de-compasso', 'armada-to-esquiva',
        'queixada', 'chapa', 'bencao', 'ponteira'],
      low: ['rasteira-de-fronte', 'rasteira-em-pe', 'martelo-no-chao', 'rabo-de-arraia',
        'rasteira-de-costas'],
      close: ['rasteira-de-fronte', 'rabo-de-arraia', 'chapa', 'rasteira-em-pe'],
      entry: ['martelo-from-a-step-forward', 'chapa-from-a-step-back',
        'queixada-from-a-step-back', 'meia-lua-de-compasso-double'],
      evade: ['esquiva-de-frente', 'esquiva-lateral', 'esquiva-de-costas', 'cocorinha', 'macaco'],
    };

    // React to contact: a block means the player read us — flip level next time.
    this.el.addEventListener('opponent-contact', (e) => {
      if (e.detail && /hand/i.test(e.detail.target || '')) {
        this.flipLevel = true;
        this.nextAt = Math.min(this.nextAt, performance.now() + 500); // press sooner
      }
    });
  },

  active: function () {
    return typeof state !== 'undefined' && state.isSparMode &&
      state.isGameStarted && !state.showingSummary;
  },

  // Put the opponent back on its mark. Called when Spar ends, when the session
  // ends, and on the return to the welcome screen.
  recenter: function () {
    this.el.object3D.position.copy(this.home);
    this.el.setAttribute('rotation', `0 ${
      (typeof state !== 'undefined' && state.isFacingAway) ? 180 : 0} 0`);
    this.wasActive = false;
  },

  pick: function (arr) { return arr[Math.floor(Math.random() * arr.length)]; },

  guardHigh: function () {
    let y = 0, n = 0;
    for (const h of [this.leftHand, this.rightHand]) {
      if (!h) continue;
      h.object3D.getWorldPosition(this.hpos);
      if (this.hpos.y > 0.01) { y += this.hpos.y; n++; }
    }
    return n ? (y / n) > 1.25 : false;
  },

  tick: function (t, dt) {
    if (!this.active()) { this.wasActive = false; return; }
    this.cp = this.cp || this.el.components['clip-player'];
    if (!this.cp) return;
    dt = Math.min(dt, 50);

    this.player.object3D.getWorldPosition(this.ppos);
    this.el.object3D.getWorldPosition(this.mpos);
    const dx = this.ppos.x - this.mpos.x;
    const dz = this.ppos.z - this.mpos.z;
    const dist = Math.hypot(dx, dz) || 0.001;

    // Face the player (smooth). Model faces +z at yaw 0.
    const target = Math.atan2(dx, dz);
    const cur = this.el.object3D.rotation.y;
    const diff = Math.atan2(Math.sin(target - cur), Math.cos(target - cur));
    this.el.object3D.rotation.y = cur + diff * Math.min(1, (dt / 1000) * this.data.faceSpeed);

    // Close the distance when far.
    if (dist > this.data.holdRange) {
      const step = Math.min(this.data.advance * (dt / 1000), dist - this.data.holdRange);
      this.el.object3D.position.x += (dx / dist) * step;
      this.el.object3D.position.z += (dz / dist) * step;
    }

    // Decide on a varied cadence (faster on higher difficulty).
    if (!this.wasActive) { this.nextAt = t + 700; this.wasActive = true; return; }
    if (t < this.nextAt) return;

    const speed = (DIFFICULTY && gameData && DIFFICULTY[gameData.currentDifficulty])
      ? DIFFICULTY[gameData.currentDifficulty].animationSpeed : 1;
    const gap = (1400 + Math.random() * 1200) / speed;
    this.nextAt = t + gap;

    let pool;
    if (dist > this.data.farRange) {
      pool = this.pools.entry;
    } else if (dist < this.data.closeRange) {
      pool = this.pools.close;
    } else if (Math.random() < 0.18) {
      pool = this.pools.evade;
    } else {
      let high = this.guardHigh();
      if (this.flipLevel) { high = !high; this.flipLevel = false; }
      pool = high ? this.pools.low : this.pools.high; // attack away from the guard
    }
    this.cp.playMove(this.pick(pool));
  },
});
