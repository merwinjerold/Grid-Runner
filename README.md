# ⚡ GRID//RUNNER

> **A cyberpunk 3D endless runner with gravity-flipping, skateboards, and guns.**

A fully browser-based PWA endless runner built with Three.js and vanilla JavaScript. No game engine, no npm, no build step — just open `index.html` and run.

![License](https://img.shields.io/badge/license-MIT-green?style=flat-square) ![Three.js](https://img.shields.io/badge/Three.js-r158-cyan?style=flat-square) ![PWA](https://img.shields.io/badge/PWA-ready-blueviolet?style=flat-square) ![Platform](https://img.shields.io/badge/platform-mobile%20%2B%20desktop-orange?style=flat-square)
<img width="1918" height="917" alt="Screenshot 2026-06-28 191934" src="https://github.com/user-attachments/assets/8b2b35da-562c-4ca1-a082-efd7871fc852" />
<img width="1918" height="921" alt="Screenshot 2026-06-28 191906" src="https://github.com/user-attachments/assets/87689434-944e-4c6b-9bf9-50a4898b5841" />
<img width="1918" height="917" alt="Screenshot 2026-06-28 191837" src="https://github.com/user-attachments/assets/970a9b20-1c53-47f9-acd3-29261bfaa1a5" />

---

## 🎮 Live Demo

> **[Play on GitHub Pages](https://yourusername.github.io/grid-runner)**

---



---

## ✨ Features

### 🏃 Core Gameplay
- **3-lane endless runner** inside a neon cyberpunk tunnel
- **Swipe or tilt controls** — swipe left/right to change lanes, up to jump, down to slide
- **Gravity Flip** — hold the GRAVITY button to ride the ceiling and dodge floor hazards
- **Shoot** — fire your sidearm at drone obstacles ahead in your lane
- **3 shield hearts** — lose them all and the run ends
- Speed increases over time — how far can you get?

### 🛹 Boards (4 unlockable)
| Board | Tag | Trait |
|-------|-----|-------|
| **NEON DRIFT** | Balanced All-Rounder | Default board, solid stats across the board |
| **VOLT REAPER** | Overclocked Speed Frame | +16% speed, reduced gravity drain |
| **GLITCH PHANTOM** | Extended Grav-Core | Longer gravity flip duration, +10% score |
| **SOLAR WRAITH** | High-Yield Score Rig | +30% score multiplier |

### 🔫 Guns (3 types)
| Gun | Tag | Special |
|-----|-----|---------|
| **PULSE BLASTER** | Balanced Sidearm | Standard shot, fast regen |
| **LASER LANCE** | Long-Range Piercer | Pierces through multiple drones |
| **QUAKE CANNON** | Splash Demolition | Hits all lanes in splash radius |

### 🌆 World & Visuals
- Procedural neon grid tunnel with scrolling floor and ceiling textures
- Cyberpunk city backdrop — buildings with randomised lit windows, billboards, arch lights
- Animated pedestrians on sidewalks
- Flying vehicles drifting in the background
- Magenta + cyan dynamic point lighting following the player
- Depth fog for atmosphere
- Neon colour trail behind the player (changes colour when gravity-flipped)
- Scanline overlay + screen vignette
- Camera shake on hits (toggleable)

### 🎯 Collectibles & Obstacles
| Item | Effect |
|------|--------|
| 🔵 Data Orb | +25 score, +1 credit |
| 🟡 Ammo Cell | +2 ammo |
| 🟢 Gravity Cell | +35% gravity meter |
| ⬛ Jump Barrier | Must jump over (floor zone) |
| ⬛ Duck Barrier | Must slide under (ceiling zone) |
| 🚁 Drone Block | Shoot to destroy for +75 score |

### 🎵 Audio
- Procedural chiptune background music via Web Audio API (no audio files needed)
- Sound effects for every action: jump, slide, shoot, collect, hit, gravity flip, game over
- Music and SFX can be toggled independently in settings

### ⚙️ Settings
- **Control Scheme** — Swipe or Gyroscope tilt
- **Graphics Quality** — Low / Medium / High
- **Gravity Sensitivity** — Adjustable slider
- **Music / SFX / Screen Shake** — Individual toggles
- **Reset Progress** — Clear best score and credits

### 💾 Save System
- Best distance tracked across sessions via `localStorage`
- Selected board and gun persist between sessions
- Credits earned per run accumulate

### 📱 PWA Support
- Installable on Android and iOS — works like a native app
- Offline play via Service Worker cache
- Fullscreen portrait orientation
- Safe-area insets for notched phones

---

## 🕹️ Controls

### Mobile (recommended)
| Action | Control |
|--------|---------|
| Change lane | Swipe left / right  **or**  ◀ ▶ buttons |
| Jump | Swipe up |
| Slide | Swipe down |
| Gravity Flip | Hold GRAVITY FLIP button |
| Shoot | Tap FIRE button |
| Pause | ⏸ button |

### Desktop
| Action | Control |
|--------|---------|
| Change lane | Arrow keys ← → |
| Jump | Arrow Up |
| Slide | Arrow Down |
| Gravity Flip | Hold Space |
| Shoot | Click FIRE button |

---

## 📁 File Structure

```
grid-runner/
├── index.html       — UI, screens, HUD, styles (20 KB)
├── game.js          — All game logic, Three.js scene (58 KB)
├── sw.js            — Service worker for offline/PWA (2 KB)
├── manifest.json    — PWA manifest
├── icon-192.png     — App icon 192×192
├── icon-512.png     — App icon 512×512
└── Male.png         — Player character sprite
```

---

## 🚀 Running Locally

**Just open the file:**
```
Double-click index.html
```

Works in Chrome, Firefox, and Edge. No install needed.

**For PWA install + service worker (requires HTTPS or localhost):**
```bash
# Python
python3 -m http.server 8000

# Node
npx serve .
```
Then open `http://localhost:8000` and tap "Add to Home Screen".

---

## 🛠️ Tech Stack

| Tech | Version | Use |
|------|---------|-----|
| [Three.js](https://threejs.org) | r158 | 3D rendering — tunnel, player, world |
| Web Audio API | Native | Procedural music + all SFX |
| Canvas 2D API | Native | Procedural grid & window textures |
| Service Worker | Native | Offline caching + PWA |
| localStorage | Native | Save data persistence |
| Vanilla JS | ES6+ | All game logic |
| Orbitron + Chakra Petch | Google Fonts | UI typography |

Zero dependencies beyond a single Three.js CDN script tag.

---

## 🎨 Design

- **Palette:** `#00f0ff` cyan · `#ff2166` magenta · `#39ff8c` green · `#ffb020` amber on `#05030f` near-black
- **Typography:** Orbitron (headings) + Chakra Petch (UI)
- **Aesthetic:** Cyberpunk / vaporwave · neon-on-dark · grid lines · scanlines

---

## 📄 License

MIT — free to use, modify, and distribute.

---

## 🙏 Credits

Built with [Three.js](https://threejs.org) · Fonts by [Google Fonts](https://fonts.google.com) · Character art generated with AI
