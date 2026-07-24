/* global AFRAME, THREE, state, combatFeedback, gameScore, gameData */
// spar-strategist: the SLOW tier. Every few seconds it POSTs a compact summary
// of the fight to an OpenAI-compatible LLM and feeds the returned plan to
// opponent-ai (the fast tier). It never blocks the game loop — requests are
// async and pipelined, and if the LLM is slow/unreachable the rule engine keeps
// fighting on the last plan. Active only in Spar mode with the strategist toggled
// on (state.useStrategist, key G / VR left-Y).
//
// NOTE: browsers block http requests from an https page (mixed content). The
// endpoint below is https via Tailscale Serve on linuxllm (tailnet-only), so it
// works from the https GitHub Pages site AS LONG AS the viewing device is on the
// tailnet (the ts.net name only resolves there); off-tailnet it fails and the
// rule engine keeps fighting. Endpoint is thinking-OFF by default (~1s); set
// think:true for deeper but slower plans (the async design tolerates it).

AFRAME.registerComponent('spar-strategist', {
  schema: {
    endpoint: { type: 'string', default: 'https://linuxllm.ling-escalator.ts.net:8444/v1' },
    model: { type: 'string', default: 'qwen3.6-27b-mtp' },
    period: { type: 'number', default: 5000 },   // ms between plans
    timeout: { type: 'number', default: 15000 }, // ms per request
    think: { type: 'boolean', default: false },
  },

  init: function () {
    this.model = document.getElementById('model');
    this.player = document.getElementById('camera');
    this.mpos = new THREE.Vector3();
    this.ppos = new THREE.Vector3();
    this.fetching = false;
    this.nextAt = 0;
    this.lastDist = null;
    this.baseBlocks = 0;
    this.baseHits = 0;
    this.recent = [];
    this.say = document.getElementById('mestreSay');

    this.ALLOWED = [
      'martelo', 'meia-lua-de-frente', 'meia-lua-de-compasso', 'queixada', 'chapa',
      'armada-to-esquiva', 'bencao', 'ponteira', 'rasteira-de-fronte', 'rasteira-em-pe',
      'martelo-no-chao', 'rabo-de-arraia', 'esquiva-lateral', 'esquiva-de-frente',
    ];
    this.SYSTEM =
      'You are the strategist for a capoeira sparring OPPONENT in a VR game. The human ' +
      'player only defends (blocks and dodges); you direct the AI fighter. Given the ' +
      'sparring state, choose a short-term plan. Reply with ONLY compact JSON, no prose, ' +
      'no markdown fences. Schema: {"style":string,"aggression":number 0..1,' +
      '"levelBias":"low"|"high"|"mixed","nextSequence":[move slugs],"comment":string}. ' +
      'Attack AWAY from the guard (player guard high => levelBias "low", guard low => "high"). ' +
      'Raise aggression if the player blocks everything; lower it / feint if they keep getting hit. ' +
      'nextSequence: 1-3 moves chosen ONLY from ALLOWED. comment: one short coaching tip to the player. ' +
      'ALLOWED: ' + this.ALLOWED.join(', ') + '.';

    // Track recent opponent moves + contact deltas.
    this.model.addEventListener('move-start', (e) => {
      if (e.detail && e.detail.slug && e.detail.slug !== 'ginga') {
        this.recent.push(e.detail.slug);
        if (this.recent.length > 5) this.recent.shift();
      }
    });
  },

  activeNow: function () {
    return typeof state !== 'undefined' && state.isSparMode && state.useStrategist &&
      state.isGameStarted && !state.showingSummary;
  },

  tick: function (t) {
    if (!this.activeNow()) return;
    this.ai = this.ai || this.model.components['opponent-ai'];
    if (!this.ai) return;
    if (this.fetching || t < this.nextAt) return;
    this.fetching = true;
    this.requestPlan().finally(() => {
      this.fetching = false;
      this.nextAt = performance.now() + this.data.period;
    });
  },

  buildState: function () {
    this.model.object3D.getWorldPosition(this.mpos);
    this.player.object3D.getWorldPosition(this.ppos);
    const dist = +Math.hypot(this.ppos.x - this.mpos.x, this.ppos.z - this.mpos.z).toFixed(2);
    const approaching = this.lastDist != null ? dist < this.lastDist - 0.05 : false;
    this.lastDist = dist;

    const blocks = (typeof combatFeedback !== 'undefined' && combatFeedback.blockCount) || 0;
    const hits = (typeof combatFeedback !== 'undefined' && combatFeedback.hitCount) || 0;
    const blocksSince = blocks - this.baseBlocks;
    const hitsSince = hits - this.baseHits;
    this.baseBlocks = blocks; this.baseHits = hits;

    return {
      distance: dist,
      playerGuard: this.ai.guardHigh() ? 'high' : 'low',
      playerApproaching: approaching,
      blocksSince, hitsSince,
      combo: (typeof gameScore !== 'undefined' && gameScore.combo) || 0,
      score: (typeof gameScore !== 'undefined' && gameScore.score) || 0,
      difficulty: (typeof gameData !== 'undefined' && gameData.currentDifficulty) || 'normal',
      lastMoves: this.recent.slice(),
    };
  },

  requestPlan: async function () {
    const body = {
      model: this.data.model,
      messages: [
        { role: 'system', content: this.SYSTEM },
        { role: 'user', content: JSON.stringify(this.buildState()) },
      ],
      max_tokens: this.data.think ? 512 : 220,
      temperature: 0.5,
      chat_template_kwargs: { enable_thinking: this.data.think },
    };
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.data.timeout);
    try {
      const res = await fetch(this.data.endpoint.replace(/\/$/, '') + '/chat/completions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body), signal: ctrl.signal,
      });
      const data = await res.json();
      const content = data && data.choices && data.choices[0] && data.choices[0].message &&
        data.choices[0].message.content;
      const plan = this.parsePlan(content);
      if (plan) {
        this.ai.applyPlan(plan);
        if (plan.comment) this.showComment(plan.comment);
        console.log('[strategist] plan', plan);
      }
    } catch (e) {
      console.warn('[strategist] request failed (rules keep running):', e && e.message);
    } finally {
      clearTimeout(timer);
    }
  },

  parsePlan: function (content) {
    if (!content || typeof content !== 'string') return null;
    let s = content.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    const a = s.indexOf('{'), b = s.lastIndexOf('}');
    if (a >= 0 && b > a) s = s.slice(a, b + 1);
    try { return JSON.parse(s); } catch (e) { console.warn('[strategist] bad JSON', content); return null; }
  },

  showComment: function (text) {
    if (this.say) {
      this.say.textContent = '— ' + text;
      this.say.style.display = 'block';
    }
  },
});
