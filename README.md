# Sprite asset guide

The game currently draws its scene in `game.js`; no external sprite files are
loaded yet. These folders are ready for downloaded PNGs. No third-party artwork
has been copied into this project.

## Recommended sources

| Use | Source | License and fit |
| --- | --- | --- |
| Player, generic enemies | [Kenney Roguelike Characters](https://kenney.nl/assets/roguelike-characters) | Small, simple character sprites. Useful as a starting point, but it is not a zombie-specific or side-scroller pack. Kenney states that assets on its asset pages are CC0/public domain and may be used in commercial projects without attribution. |
| Platforms and environment | [Kenney Platformer Art Deluxe](https://kenney.nl/assets/platformer-art-deluxe) | Purpose-built platformer environment art; an easy way to get modular ground and scenery. Its clean style is not dark pixel art, so recolor/tint or mix selectively. Same Kenney CC0 terms. |
| Props and item ideas | [Kenney Roguelike/RPG Pack](https://kenney.nl/assets/roguelike-rpg-pack) | Useful for small props and item pieces, though much of this style is top-down rather than side-on. Same Kenney CC0 terms. |
| Muzzle flashes and impact particles | [Kenney Particle Pack](https://kenney.nl/assets/particle-pack) | Small effect sprites; use for flashes/impacts, not as a complete bullet or projectile set. Same Kenney CC0 terms. |
| Bullets/projectiles | Draw a small shape with canvas for now, or search for a pixel projectile sheet on OpenGameArt and check that item's license | A simple 8×8 glow/slug can be drawn without importing another pack. The Kenney particle pack is for effects, not a projectile pack. |
| Health/ammo/upgrade pickups | Kenney Roguelike/RPG Pack for reusable small props, or a separately licensed OpenGameArt item sheet | Prefer item sprites that read clearly at 16×16 or 24×24; the Kenney pack's top-down style may not match the side view. Verify the individual OpenGameArt asset license. |
| Zombie and boss sprites | [OpenGameArt zombie search](https://opengameart.org/art-search-advanced?keys=zombie) | This is a search source, not a blanket license. Select a 2D sprite/sprite-sheet and verify that the individual asset is marked CC0/public domain (or another license you accept) before use. Record the author and attribution text where required. Licenses differ between submissions. |

Kenney's [license/support page](https://kenney.nl/support) says its game assets
are CC0, including for commercial use. Keep the downloaded archive's license
file with the files anyway. OpenGameArt assets are licensed individually:
check the asset page and any included license/readme, and do not infer a
license from the search result or from another asset on the site.

**Easiest starting point:** download the Kenney packs from their named asset
pages and copy selected images from the archives; the shared CC0 terms make
reuse and commercial use straightforward. OpenGameArt is the better place to
look for an actual zombie or boss, but takes more work because each submission
has its own license and attribution requirements.

For the closest visual match, use a single pixel-art zombie set for both the
walker and boss if it includes multiple variants, then source the player,
terrain, pickups and effects from compatible pixel-art packs. A boss can be
made from an explicitly licensed larger zombie sprite or a larger/edited
variant; check that the source license permits modifications. Darken art in
the game with a canvas overlay rather than changing the source files.

## Download and file organization

Download from the source's own asset page, extract the archive locally, and
copy only the needed PNGs into the folders below. Preserve each archive's
`LICENSE`, `license.txt`, or attribution/readme beside the files it covers.
Rename only your working copy, and note the original pack and author in your
project's asset notes. Do not hotlink source images from the game.

Suggested names:

```text
assets/sprites/
  player/player-survivor.png
  enemies/zombie-walker.png
  boss/zombie-boss.png
  projectiles/pistol-bullet.png
  items/health-medkit.png
  items/ammo-crate.png
  background/factory-tiles.png
  background/night-sky.png
```

Use lowercase kebab-case names. For a sprite sheet, describe the frame size,
row/action order, and frame rate in the adjacent asset notes (for example
`player-survivor: 32x48 frames; rows idle, run, jump, fire, hurt, death;
8 frames per row; 10 fps`). Keep frame cells uniform and avoid adding padding
between cells unless the sheet's metadata calls for it.

## Canvas sizing and rendering

The canvas is 960×540 and the current player collision box is 32×42. A practical
starting point is 32×48 player/enemy frames (align the feet to the collision
box), 64×64 or 96×96 boss frames, 16×16 or 24×24 pickups, and 8×8 to 16×16
projectiles/effects. Use 16×16 or 32×32 environment tiles. A sprite sheet with
8 columns of 32×48 frames is 256×48 per animation row; keep atlas dimensions
to convenient multiples of 256 or 512 when possible. These are recommendations,
not requirements; always use the source sheet's actual frame dimensions.

For pixel art, disable smoothing after obtaining the 2D context. Draw one
animation frame by specifying its source rectangle in the sheet:

```js
ctx.imageSmoothingEnabled = false;

const spriteSheet = new Image();
spriteSheet.src = "assets/sprites/player/player-survivor.png";

function drawFrame(image, frame, frameWidth, frameHeight, x, y, width, height) {
  const sx = frame.column * frameWidth;
  const sy = frame.row * frameHeight;
  ctx.drawImage(
    image,
    sx, sy, frameWidth, frameHeight,
    Math.round(x), Math.round(y), width, height
  );
}
```

Advance the frame on a timer rather than every render call, and wrap within
that animation's row:

```js
const runAnimation = { row: 1, frames: 8, fps: 10, elapsed: 0, column: 0 };

function updateAnimation(animation, deltaSeconds) {
  animation.elapsed += deltaSeconds;
  const frameDuration = 1 / animation.fps;
  while (animation.elapsed >= frameDuration) {
    animation.elapsed -= frameDuration;
    animation.column = (animation.column + 1) % animation.frames;
  }
}
```

Wait for `spriteSheet.onload` (or check `spriteSheet.complete` and
`naturalWidth`) before drawing. Use the same `drawImage` source rectangle
pattern for idle/run/jump/fire/death rows; change `row` and `frames` when the
player or enemy state changes.

## Integration plan for Nightfall

The current canvas is 960×540. Rendering and game rules are already separate:
`drawScene()` calls `drawBackground`, `drawPlatforms`, `drawPickups`,
`drawBullets`, `drawZombies`, `drawParticles`, then `drawPlayer`. Keep that
draw order and replace only the shape drawing inside those functions. Leave
`update`, collision checks, entity constructors, and all entity dimensions
unchanged. Treat sprite dimensions and positions as visual-only; continue to
use each entity's current `x`, `y`, `w`, and `h` for gameplay.

Current hitboxes and render choices:

| Entity | Existing gameplay size | Visual draw target |
| --- | --- | --- |
| Player | 32×42 | 32×48, feet aligned to `player.y + player.h` |
| Walker | 34×30 | 32×48, feet aligned to `zombie.y + zombie.h` |
| Runner | 30×30 | 32×48; can use a separate sheet or different animation speed |
| Boss | 82×90 | 96×96, centered on its current hitbox |
| Pickups | 24×24 | 24×24, one static icon per pickup type |
| Player bullet | 12×5 | Keep canvas drawn initially, or 12×8 art |
| Boss bullet | 16×14 | Keep the glowing red circle, or 16×16 art |
| Platforms | Variable width | Keep current geometry; add repeated 16×16/32×32 tile details |

Use the existing state for animation selection, rather than adding animation
state to gameplay:

| Character | Row order | Suggested frames |
| --- | --- | --- |
| Player | idle, walk, jump/fall, attack, hurt, death | 4, 6, 1–2, 3, 2, 5 |
| Zombie | idle, walk, attack, hurt, death | 2–4, 6, 3, 2, 5 |
| Boss | idle, walk, attack, hurt, death | 2–4, 6, 4, 2, 6 |

These are authoring targets, not assumptions: use the actual sheet frame
dimensions and animation rows. The current game has no explicit zombie or boss
attack/death animation state; do not change combat to add one. Initially show
walk/idle for enemies, and choose the boss attack row while its existing
`attackCooldown` is near its firing threshold if the sheet supports it.
Defeated zombies are removed immediately, and the player game-over screen
appears immediately, so hurt/death frames will only be useful if they can show
within existing timing. Skip extending those gameplay timings in this pass.

For facing, wrap the draw call in a save/restore pair so the flip cannot leak
into other entities. Flip around the sprite's center and use integer screen
coordinates:

```js
function drawFacingFrame(image, sx, sy, frameWidth, frameHeight, x, y, width, height, facing) {
  const drawX = Math.round(x);
  const drawY = Math.round(y);
  ctx.save();
  if (facing < 0) {
    ctx.translate(drawX + width, drawY);
    ctx.scale(-1, 1);
    ctx.drawImage(image, sx, sy, frameWidth, frameHeight, 0, 0, width, height);
  } else {
    ctx.drawImage(image, sx, sy, frameWidth, frameHeight, drawX, drawY, width, height);
  }
  ctx.restore();
}
```

Set `ctx.imageSmoothingEnabled = false` once after creating the context. For
player animation, derive idle/walk from `player.vx`, jump/fall from
`player.onGround` and `player.vy`, attack from `player.shootCooldown`, and hurt
from `player.hitCooldown`. Zombies and the boss already have `vx`; use it for
facing and walk/idle. Advance frames using elapsed time, not the number of
render calls. For pickup art, retain the current `pickup.type` values
(`health`, `ammo`, `rapid`, `piercing`) and keep the existing bobbing position.
Do not change bullet dimensions or collision rectangles to fit projectile art.

Recommended low-risk sequence:

1. Add an image loader and sprite-sheet metadata, with a fallback to the
   current drawing when an image has not loaded or fails to load.
2. Replace `drawPlayer` art, preserving the existing shadow and hit-flash
   feedback. Test movement, jump, aim direction, firing, and damage.
3. Replace walker and runner visuals in `drawZombies`; leave `makeZombie`,
   `updateZombies`, and collision unchanged.
4. Replace the boss visual, keeping its current 82×90 collision bounds and
   attack logic.
5. Replace pickup squares and letters with icons keyed by `pickup.type`.
6. Add restrained platform surface details and distant silhouettes while
   retaining the procedural sky, moon, stars, hills, parallax, and platform
   geometry.

First-pass minimum: one survivor sheet (idle/walk/jump/attack), one zombie
sheet used for both walker and runner, one boss image, and four pickup icons.
Keep bullets, boss orbs, particles, moon, stars, hills, and platform geometry
canvas-drawn for now. This yields the largest visual improvement with only
three character assets plus the pickup icons, while limiting changes to the
rendering functions.

For each imported image, keep its original pack/source name, author if listed,
license, and required attribution in an adjacent `README.md` or
`assets/sprites/licenses/`. Favor CC0 or public-domain packs; for any other
license, verify modification and commercial-use permissions before including
it in a distributed game.
