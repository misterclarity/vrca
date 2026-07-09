/* global AFRAME, THREE, state, startGame, endSession, resetToWelcome, updateModel,
   toggleRodaMode, toggleHelpScreen, setDifficulty, handleGripDown, handleGripUp,
   handleTriggerDown, gameScore */
// desktop-fallback: play the sim on a flatscreen (no VR headset).
//   - keyboard mapped to the same actions as the Quest controllers
//   - both hand colliders ride a guard position in front of the camera, so
//     kicks that reach you register as blocks (dodge by looking/moving away)
// Disables itself in VR so meta-touch-controls owns the hands there.
//
// Keys:
//   Space/Enter  start game / continue from summary
//   J            throw offensive move      K   throw defensive move
//   R            toggle Roda mode          H   toggle help
//   Shift(hold)  slow motion               T   turn opponent around
//   E            end session               1/2/3  difficulty (menu)

AFRAME.registerComponent('desktop-fallback', {
  init: function () {
    this.cam = document.getElementById('camera');
    this.left = document.getElementById('leftHand');
    this.right = document.getElementById('rightHand');
    this.v = new THREE.Vector3();
    this.q = new THREE.Quaternion();
    this.offL = new THREE.Vector3(-0.2, -0.3, -0.4);
    this.offR = new THREE.Vector3(0.2, -0.3, -0.4);

    // Show the guard spheres on desktop so the player can see their block.
    [this.left, this.right].forEach((h) => {
      const s = h && h.querySelector('a-sphere');
      if (s) s.setAttribute('visible', true);
    });

    const has = (fn) => typeof window[fn] === 'function';
    this.onKeyDown = (e) => {
      if (e.repeat) return;
      const k = e.key.toLowerCase();
      const started = typeof state !== 'undefined' && state.isGameStarted;
      const summary = typeof state !== 'undefined' && state.showingSummary;
      const roda = typeof state !== 'undefined' && state.isRodaModeActive;
      switch (k) {
        case ' ': case 'enter':
          if (summary) { if (gameScore && gameScore.hideSummary) gameScore.hideSummary(); resetToWelcome(); }
          else if (!started && has('startGame')) startGame();
          e.preventDefault(); break;
        case 'j': if (started && !roda && !summary && has('updateModel')) updateModel('offensive'); break;
        case 'k': if (started && !roda && !summary && has('updateModel')) updateModel('defensive'); break;
        case 'r': if (has('toggleRodaMode')) toggleRodaMode(); break;
        case 'h': if (has('toggleHelpScreen')) toggleHelpScreen(); break;
        case 't': if (has('handleTriggerDown')) handleTriggerDown(); break;
        case 'e': if (started && !summary && has('endSession')) endSession(); break;
        case 'shift': if (has('handleGripDown')) handleGripDown(); break;
        case '1': if (!started && has('setDifficulty')) setDifficulty('easy'); break;
        case '2': if (!started && has('setDifficulty')) setDifficulty('normal'); break;
        case '3': if (!started && has('setDifficulty')) setDifficulty('hard'); break;
      }
    };
    this.onKeyUp = (e) => {
      if (e.key === 'Shift' && has('handleGripUp')) handleGripUp();
    };
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
  },

  tick: function () {
    if (this.el.is('vr-mode')) return; // controllers own the hands in VR
    if (!this.cam) return;
    this.cam.object3D.getWorldPosition(this.v);
    this.cam.object3D.getWorldQuaternion(this.q);
    this.left.object3D.position.copy(this.offL).applyQuaternion(this.q).add(this.v);
    this.right.object3D.position.copy(this.offR).applyQuaternion(this.q).add(this.v);
  },

  remove: function () {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
  },
});
