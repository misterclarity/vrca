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

## Controls

The application is optimized for **Oculus/Meta Quest** controllers:

| Action | Left Controller | Right Controller |
| :--- | :--- | :--- |
| **Start Game** | - | **B Button** |
| **Next Offensive Move** | **A Button** | - |
| **Next Defensive Move** | **B Button** | - |
| **Toggle Roda Mode** | **X Button** | **A Button** |
| **Slow Motion** | **Grip (Hold)** | **Grip (Hold)** |
| **Rotate Model** | **Trigger** | **Trigger** |
| **Toggle Help Guide** | **Joystick Press** | **Joystick Press** |
| **Center Screen** | **Oculus Button (Hold)** | **Oculus Button (Hold)** |
| **Exit Game** | **Oculus Button (Press)** | **Oculus Button (Press)** |

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
2. **Start**: Focus on the welcome screen and press the **B button** on your **right controller**.
3. **Practice**: 
    - Use the left controller buttons (**A** for offensive, **B** for defensive) to cycle through moves manually.
    - Hold the **Grip** button to see the move in slow motion for better form analysis.
    - Press **X** (Left) or **A** (Right) to enter **Roda Mode**, where moves will change automatically every 10 seconds.
4. **Learn More**: Visit [lalaue.com](https://lalaue.com) for deeper insights into Capoeira culture and techniques.

## Technical Details

- **Engine**: [A-Frame](https://aframe.io/) (v1.7.0)
- **Physics**: [aframe-physics-system](https://github.com/c-frame/aframe-physics-system) (Cannon.js driver)
- **Components**: 
  - `bone-proxy`: A custom helper that syncs physics bodies with GLTF bones.
  - `aframe-environment-component` for the forest setting.
  - `aframe-extras` for animation playback.
- **Assets**: 3D models hosted on Glitch CDN.

---
*Created for Capoeira practitioners and VR enthusiasts.*
