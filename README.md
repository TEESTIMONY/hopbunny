# Neon Runner

A 3D endless runner game built with Three.js and Cannon.js featuring neon wireframe aesthetics.

![Neon Runner Game](./screenshot.png)

## Features

- Procedurally generated endless track
- Ball physics with realistic movement and collision detection
- Neon wireframe visual aesthetic with a dark background
- Obstacles: wireframe cubes and ramps
- Increasing difficulty as you progress (speed increases)
- Score counter and game-over screen
- Responsive controls: keyboard and touch support

## How to Play

### Controls

- **Keyboard**: Use the Left/Right arrow keys or A/D keys to move the ball
- **Mobile**: Swipe or hold left/right side of the screen

### Objective

- Stay on the track as long as possible
- Avoid obstacles or use ramps to jump over them
- The game ends when the ball falls off the track

## Setup and Run

1. Clone this repository
2. Open the `index.html` file in your browser

Or simply visit [live demo URL] to play online.

## Technologies Used

- **Three.js** - 3D graphics library
- **Cannon.js** - Physics engine
- **JavaScript** - Game logic and controls

## Performance Notes

- The game is optimized for performance by:
  - Only rendering visible track segments
  - Removing obstacles and track segments that are no longer visible
  - Using simple wireframe geometries
  - Optimizing physics calculations

## License

MIT 