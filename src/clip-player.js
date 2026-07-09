/* global AFRAME */
// clip-player: drives one persistent skinned mesh with lazy-loaded external
// animation clips (one GLB per move). Ports capoeiraNice's FSM:
//   - idle move loops (Ginga)
//   - any other move plays once, then crossfades back to idle
// The mesh (opponent.glb) is loaded once; clips are tiny and fetched on demand.
//
// NOTE: the method is playMove(), NOT play() — `play` is a reserved A-Frame
// component lifecycle method and must not be overridden.
//
// API (call from game code):
//   el.components['clip-player'].playMove('martelo')   // by manifest slug
// Events emitted on el:
//   'clip-ready'                       mixer built, idle playing
//   'move-start'  {slug, type, isIdle}
//   'move-finish' {slug}               a one-shot special finished

AFRAME.registerComponent('clip-player', {
  schema: {
    manifest: { type: 'string', default: 'assets/moves.json' },
    idle: { type: 'string', default: 'ginga' },
    fade: { type: 'number', default: 0.2 },
    timeScale: { type: 'number', default: 1 },
  },

  init: function () {
    const THREE = AFRAME.THREE;
    this.THREE = THREE;
    this.loader = new THREE.GLTFLoader();
    this.mixer = null;
    this.actions = {};   // slug -> AnimationAction
    this.moves = {};     // slug -> manifest entry
    this.current = null; // active slug
    this.prev = null;
    this._onFinished = this._onFinished.bind(this);
    this._pending = null; // slug requested before mixer/manifest ready

    // Load the move manifest.
    fetch(this.data.manifest)
      .then((r) => r.json())
      .then((list) => {
        list.forEach((m) => { this.moves[m.slug] = m; });
        this.el.emit('clip-manifest-ready', { moves: list });
        this._maybeStart();
      })
      .catch((e) => console.error('[clip-player] manifest load failed', e));

    // Build the mixer once the skinned mesh is present.
    const setup = () => {
      const obj = this.el.getObject3D('mesh');
      if (!obj || this.mixer) return;
      this.mixer = new THREE.AnimationMixer(obj);
      this.mixer.addEventListener('finished', this._onFinished);
      this._maybeStart();
    };
    if (this.el.getObject3D('mesh')) setup();
    else this.el.addEventListener('model-loaded', setup);
  },

  _maybeStart: function () {
    if (!this.mixer || !Object.keys(this.moves).length || this._started) return;
    this._started = true;
    this.el.emit('clip-ready');
    this.playMove(this._pending || this.data.idle);
  },

  _load: async function (slug) {
    if (this.actions[slug]) return this.actions[slug];
    const entry = this.moves[slug];
    if (!entry) throw new Error('[clip-player] unknown move: ' + slug);
    const gltf = await this.loader.loadAsync(entry.file);
    const clip = gltf.animations[0];
    if (!clip) throw new Error('[clip-player] no animation in ' + entry.file);
    clip.name = slug;
    const action = this.mixer.clipAction(clip);
    this.actions[slug] = action;
    return action;
  },

  playMove: async function (slug) {
    if (!this.mixer) { this._pending = slug; return; }
    if (slug === this.current) return;
    const THREE = this.THREE;
    const isIdle = slug === this.data.idle;

    let next;
    try { next = await this._load(slug); }
    catch (e) { console.error(e); return; }
    // A newer playMove() may have superseded us while loading.
    if (this._pending && this._pending !== slug) return;

    const prevAction = this.current ? this.actions[this.current] : null;

    next.reset();
    next.enabled = true;
    next.setEffectiveTimeScale(1);
    next.setEffectiveWeight(1);
    if (isIdle) {
      next.setLoop(THREE.LoopRepeat, Infinity);
      next.clampWhenFinished = false;
    } else {
      next.setLoop(THREE.LoopOnce, 1);
      next.clampWhenFinished = true;
    }

    if (prevAction && prevAction !== next) next.crossFadeFrom(prevAction, this.data.fade, true);
    next.play();

    this.prev = this.current;
    this.current = slug;
    this._pending = null;
    this.el.emit('move-start', { slug, type: this.moves[slug] && this.moves[slug].type, isIdle });
  },

  _onFinished: function (e) {
    // Only react to the currently active one-shot special finishing.
    if (!this.current || this.current === this.data.idle) return;
    if (this.actions[this.current] !== e.action) return;
    const finished = this.current;
    this.el.emit('move-finish', { slug: finished });
    this.playMove(this.data.idle);
  },

  tick: function (t, dt) {
    if (this.mixer) this.mixer.update((dt / 1000) * this.data.timeScale);
  },

  remove: function () {
    if (this.mixer) this.mixer.removeEventListener('finished', this._onFinished);
  },
});
