# Art Explore — Brand Assets

Everything needed to apply the **Art Explore** theme in the admin panel.

## Colours
| Role | Hex | Used for |
|------|-----|----------|
| Deep Brown (primary) | `#402820` | Primary surface, mobile menu overlay, active filter pill |
| Rust Red (accent) | `#b83808` | Icon, links, highlights, active states |
| Ink (text) | `#241812` | Body text, nav labels |
| Paper (light bg) | `#FAF7F4` | Light backgrounds, cards |
| White | `#FFFFFF` | Navbar (scrolled), reversed logo |

## Typography
- **Brand font:** Canva Sans
- **Web build substitute:** Poppins (Google Fonts), weights 300 / 400 / 500 / 600 — near-identical geometric sans, licensed for web. Use until a Canva Sans web licence is provided.

## Logo files (`/logos`)
| File | What it is | Use on |
|------|-----------|--------|
| `wordmark-brown.png` | Full lockup, brown ink | Light backgrounds |
| `wordmark-white.png` | Full lockup, white ink (transparent) | Dark / brown backgrounds, site header |
| `wordmark-white-on-brown.jpg` | White lockup on brown tile | Preview / reference |
| `favicon-red.png` | Compass icon, red | Favicon on light bg |
| `favicon-brown.png` | Compass icon, brown | Icon on light bg |
| `icon-white.png` | Compass icon, white (transparent) | Icon on dark bg |

## Favicon
Use `favicon-red.png` (compass only). Export at 16, 32, 48, 180 (Apple touch) and 512 px. Keep ~12% clear padding inside the square.

## Admin theme tokens (copy-paste)
```
primary        #402820
accent         #b83808
text           #241812
background      #FAF7F4
heading font   Poppins (Canva Sans)
body font      Poppins 300–400
favicon        favicon-red.png
header logo    wordmark-white.png
```

## Do / Don't
**Do** — white wordmark on dark; brown/red mark on light; keep clear space of one compass-width; use PNGs at native ratio.
**Don't** — recolour outside the palette; stretch/rotate; place white wordmark on light backgrounds; add shadows or glows.

See `Art Explore Brand Assets.pdf` (the deck) for visual reference.