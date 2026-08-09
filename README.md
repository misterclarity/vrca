# Capoeira VR Trainer

An immersive Virtual Reality application designed to help users learn and practice fundamental Capoeira movements. Built with A-Frame, this trainer provides a 3D environment where you can follow along with professionally animated models.

## Features

- **Professional Animations**: High-quality 3D models demonstrating core offensive and defensive Capoeira moves.
- **VR Immersive Environment**: Practice in a serene forest setting with atmospheric music.
- **Roda Mode**: An automatic training mode that sequences moves to challenge your adaptability.
- **Physics-Based Hitboxes**: Animated colliders (feet) that can interact with objects in the world.
- **Study Tools**:
    - **Slow Motion**: Slow down animations to study technique details.
    - **Rotation**: Rotate models or change your perspective to see moves from different angles.
- **Cross-Hand Controls**: Full integration with Oculus/Meta Quest touch controllers.
- **Bare-Hand Training**: Quest hand tracking is supported as a first-class input — block with your actual hands, no controllers needed.

## Controls

The application is optimized for **Oculus/Meta Quest** controllers. Quest
hardware reports **X/Y on the left controller and A/B on the right one** — every
binding below lives on the hand that physically owns the button.

### In a session

| Action | Button |
| :--- | :--- |
| **Next attack to study** | **A** (right) |
| **Next defence to study** | **B** (right) |
| **Toggle Roda mode** | **X** (left) |
| **Toggle Spar mode** (reactive opponent) | **Y** (left) |
| **Turn the opponent around** | **Trigger** (either hand) |
| **Slow motion** | **Grip, hold** (either hand) |
| **Controls card** | **Thumbstick press** (either hand) |
| **End session & see stats** | **B, hold** (right) |

A tap on **B** steps to the next defensive move; *holding* it ends the session,
so a session can't be dropped by a stray press.

### On the welcome screen

| Action | Button |
| :--- | :--- |
| **Start session** | **A** or **B** (right) |
| **Choose difficulty** | **Thumbstick left / right**, or **X** (left) to cycle |
| **Preview the model from behind** | **Trigger** (either hand) |

### With bare hands (no controllers)

Put the controllers down and Quest hand tracking takes over — a better fit for
whole-body movement. Hands report no buttons, only a pinch, so the scheme
collapses onto two hands x (tap, hold):

| Action | Gesture |
| :--- | :--- |
| **Confirm / next attack** | **Pinch right** |
| **Next defence** | **Pinch left** |
| **Cycle mode** (Training / Roda / Spar) | **Hold a right pinch** |
| **End session** | **Hold a left pinch** |
| **Controls card** | **Pinch both hands** |

Blocking works the same either way: the guard points follow the tracked wrist
when you're using hands and the controller when you aren't, and the app swaps
its on-screen prompts to match whichever you pick up.

### On a flatscreen (no headset)

`W A S D` + mouse to move and look. `Space` start · `J` next attack ·
`K` next defence · `R` Roda · `F` Spar · `T` turn · `Shift` (hold) slow motion ·
`E` end session · `1`/`2`/`3` difficulty · `H` controls card.

## On-screen guidance

The interface is built to stay out of the way while you train:

- **Wrist controls card** — press a thumbstick (or pinch both hands) and the
  full control reference appears on your left hand, angled to face you. It
  doesn't hide the rest of the HUD and it times out on its own. Its rows are
  generated from a single control table, so they can't drift from the actual
  bindings, and they relabel themselves for controllers, bare hands or the
  keyboard depending on what you're holding.
- **Coach line** — one short hint at a time, low in the view, which dismisses
  itself instead of parking permanently on screen.
- **First-run onboarding** — three one-line lessons on your first session only,
  in place of a wall of text.
- **Peripheral readouts** — score, combo and level share one slim strip at the
  top edge; stats and mode sit dimmed in the bottom corners. Hit and block
  feedback is transient floating text, so the space in front of the opponent
  stays clear.
- **Sized for the headset** — a Quest 2 resolves roughly 20 pixels per degree,
  so every HUD string is set to a character width of about 1° at the 1.5 m HUD
  plane. `wrapCount` is therefore explicit throughout rather than left at
  A-Frame's default; captions that could only have been rendered below that
  threshold were dropped instead of shrunk.
- **Drawn as an overlay** — the head-locked HUD renders above the world, so a
  lunge or a cartwheel can't push the opponent's limbs through a panel.
- **Lazy-follow** — the HUD trails your head rather than being welded to it. It
  holds still while you look around within a 6° dead zone, then eases back to
  centre. Rigidly head-locked panels never settle, which wears over a session.

## Scoring

A block counts when a hand is inside `handRadius` (0.22 m) of an incoming limb
**and** actually moving — a guard parked in the path of a kick doesn't score.
Head contact uses a wider 0.3 m radius. Hits, blocks and landed strikes each
keep their own cooldown, so two contacts in the same instant both register.
All three thresholds are `hit-detect` schema properties if you want to retune
them:

```html
<a-gltf-model hit-detect="handRadius: 0.22; blockSpeed: 0.15; radius: 0.3">
```

## Available Moves

### Defensive & Transitional
- **Ginga**: The fundamental footwork of Capoeira.
- **Macaco**: A "monkey" move used for evasion or transition.
- **Troca**: An exchange of legs or positions.

### Offensive
- **Martelo**: A powerful "hammer" kick.
- **Compasso**: A crescent-shaped "compass" kick using one hand as a pivot.

## How to Train

1. **Launch**: Open the application in your VR browser.
2. **Start**: Pick a difficulty with the thumbstick, then press **A** on your **right controller**.
3. **Practice**:
    - Use the right controller to cycle moves by hand — **A** for attacks, **B** for defences.
    - Hold **Grip** to see the move in slow motion for better form analysis.
    - Press **X** (left) for **Roda mode**, where moves change automatically on a timer.
    - Press **Y** (left) for **Spar mode**, where the opponent reads your guard and
      attacks the openings instead of running a fixed sequence.
    - Lost? Press a thumbstick for the controls card on your wrist.
4. **Learn More**: Visit [lalaue.com](https://lalaue.com) for deeper insights into Capoeira culture and techniques.

## Technical Details

- **Engine**: [A-Frame](https://aframe.io/) (v1.8.0)
- **Collision**: distance checks between the opponent's attacking bones and the
  player's guard points — no physics engine.
- **Components**:
  - `clip-player`: drives one persistent skinned mesh with lazy-loaded external
    clips. Clips ship with root motion baked into the hips (ginga travels 2.2 m
    sideways), which would walk the opponent off her mark and into the camera,
    so `lockRootMotion` zeroes the hips' horizontal track and keeps vertical
    motion. Set it to `false` for clips that should travel.
  - `opponent-ai`: the reactive opponent behind Spar mode. It closes distance
    while sparring and is recentred when Spar, the session, or the menu ends.
  - `hit-detect` / `follow-camera`: contact detection and player guard points.
  - `billboard-to-camera`: keeps the wrist controls card facing the player.
  - `hud-overlay` / `flat-panel`: draw the HUD above the world and unlit, so it
    neither gets occluded nor picks up the environment's colour cast.
  - `lazy-follow`: lets the HUD trail the head instead of being welded to it.
  - `vr-floor-camera`: drops the camera's flatscreen height offset in VR.
    A-Frame requests a `local-floor` reference space, so the headset already
    reports eye height from the real floor and the offset would otherwise stack
    on top of it. This is also what makes seated and standing play work without
    manual calibration.
  - `roda-clock`: the Roda countdown, driven by the render loop. A `setInterval`
    drifts against the animation and banks missed ticks while the headset sleeps,
    then burns through several rounds at once on wake; a frame-driven clock just
    pauses and resumes.
  - `guard-point`: the entities that actually block. Each follows whichever
    input is live, because `hand-tracking-controls` pins its own entity to the
    origin every frame and publishes joints separately — so the wrist joint is
    read in hand-tracking mode and the controller transform otherwise.
  - `desktop-fallback`: keyboard + guard-hand blocking without a headset.
  - `aframe-environment-component` for the setting, `aframe-extras` for animation.
- **Fonts**: every A-Frame stock font is ASCII-only, which silently dropped
  characters from 18 of the 58 playable move names. `assets/fonts/capoeira-sdf`
  is a DejaVu Sans SDF atlas covering Latin-1, so `Aú`, `Benção` and
  `Chapéu de couro` render properly.
- **Memory**: `clip-player` keeps the 20 most recently played clips
  (`maxCachedClips`) and evicts the rest from the mixer. All 58 would otherwise
  stay parsed in memory for the whole session; evicted clips reload on demand,
  and the idle and on-screen clips are never candidates.
- **Input**: `meta-touch-controls` and `hand-tracking-controls` sit on the same
  entities, which is A-Frame's supported way to accept controllers and bare
  hands in one app; hand tracking is requested via
  `webxr="optionalFeatures: bounded-floor, hand-tracking"`.
- **Profiling**: append `?stats` to the URL for A-Frame's stats overlay
  (stats-gl as of 1.8, so it reports GPU timings). Off otherwise.
- **Assets**: opponent mesh and per-move animation clips under `assets/`.

---
*Created for Capoeira practitioners and VR enthusiasts.*
