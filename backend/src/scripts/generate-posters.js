/**
 * Generate unique SVG posters for each work
 * Each poster is a data URL (base64 encoded SVG) with:
 * - Unique gradient background based on work ID
 * - Work title text
 * - Creator name
 * - Type badge
 * - Decorative elements based on synopsis keywords
 */

const works = [
  { id: 1, title: "Echoes of Tomorrow", creator: "Maya Chen", type: "SHORT_FILM", synopsis: "memory and identity" },
  { id: 2, title: "Neon Nights", creator: "Kai Zhang", type: "SHORT_FILM", synopsis: "cyberpunk detective neon city" },
  { id: 3, title: "The Glitch in Paradise", creator: "Lucas Martinez", type: "SHORT_FILM", synopsis: "surreal simulation" },
  { id: 4, title: "Paper Hearts", creator: "Yuki Tanaka", type: "SHORT_FILM", synopsis: "origami coming to life" },
  { id: 5, title: "Beyond the Screen", creator: "James Wright", type: "FEATURE_FILM", synopsis: "AI falls in love" },
  { id: 6, title: "Chromatic Aberration", creator: "Pierre Dubois", type: "SHORT_FILM", synopsis: "color theory perception" },
  { id: 7, title: "Voices from the Static", creator: "Omar Hassan", type: "SHORT_FILM", synopsis: "parallel universes TV" },
  { id: 8, title: "The Final Canvas", creator: "Maria Garcia", type: "SHORT_FILM", synopsis: "elderly painter masterpiece" },
  { id: 9, title: "Dust and Stars", creator: "Claire Dubois", type: "SHORT_FILM", synopsis: "astronaut Mars transmission" },
  { id: 10, title: "The Archive", creator: "Dr. Priya Sharma", type: "DOCUMENTARY", synopsis: "preserving culture" },
  { id: 11, title: "The Last Library", creator: "Emma Wilson", type: "SHORT_FILM", synopsis: "post-apocalyptic librarian" },
  { id: 12, title: "Symphony of Data", creator: "Viktor Novak", type: "SHORT_FILM", synopsis: "big data orchestral" },
  { id: 13, title: "The Last Human", creator: "Alexander K.", type: "SHORT_FILM", synopsis: "last survivor AI beings" },
  { id: 14, title: "The Painter's Algorithm", creator: "Elena Rossi", type: "SHORT_FILM", synopsis: "paintings come to life" },
  { id: 15, title: "Bloom", creator: "Lily Green", type: "SHORT_FILM", synopsis: "flower blooms thousand years" },
  { id: 16, title: "Codebreaker", creator: "Arthur Pendleton", type: "SHORT_FILM", synopsis: "Bletchley Park codebreakers" },
  { id: 17, title: "The Reset Button", creator: "Tom Bradley", type: "SHORT_FILM", synopsis: "comedy reset life" },
  { id: 18, title: "Midjourney Cinema Vol. 1", creator: "AI Collective", type: "SHORT_FILM", synopsis: "Midjourney cinematic" },
  { id: 19, title: "Runway Gen-2 Showcase", creator: "Runway Studios", type: "SHORT_FILM", synopsis: "Runway Gen-2 video" },
  { id: 20, title: "Stable Video Diffusion Art", creator: "Stability AI", type: "SHORT_FILM", synopsis: "abstract motion color" },
  { id: 21, title: "Kling AI Cinematic", creator: "Kuaishou AI Lab", type: "SHORT_FILM", synopsis: "photorealistic AI video" },
  { id: 22, title: "Hailuo AI Mini Cinema", creator: "MiniMax", type: "SHORT_FILM", synopsis: "miniature cinema stories" },
  { id: 23, title: "CogVideo Showcase", creator: "Tsinghua University", type: "SHORT_FILM", synopsis: "text-to-video academic" },
  { id: 24, title: "AnimateDiff Cinema", creator: "Open Source AI", type: "SHORT_FILM", synopsis: "community AI animation" },
  { id: 25, title: "Sundance AI Shorts Winner", creator: "Indie AI Collective", type: "SHORT_FILM", synopsis: "Sundance AI collaboration" },
  { id: 26, title: "Cannes AI Film Corner", creator: "European AI Collective", type: "SHORT_FILM", synopsis: "Cannes AI visuals" },
  { id: 27, title: "Berlinale AI Forum", creator: "German AI Artists", type: "SHORT_FILM", synopsis: "Berlin divided history" },
  { id: 28, title: "Venice AI Biennale", creator: "Italian AI Art", type: "SHORT_FILM", synopsis: "water and memory" },
  { id: 29, title: "TIFF AI Showcase", creator: "Canadian AI Filmmakers", type: "SHORT_FILM", synopsis: "AI ethics narrative" },
  { id: 30, title: "Busan AI Film Festival", creator: "Korean AI Animation", type: "SHORT_FILM", synopsis: "Korean folklore" },
  { id: 31, title: "Rotterdam AI Art Prize", creator: "Dutch AI Art", type: "SHORT_FILM", synopsis: "AI consciousness poetry" },
  { id: 32, title: "SXSW AI Film Award", creator: "Austin AI Filmmakers", type: "SHORT_FILM", synopsis: "AI music creation" },
  { id: 33, title: "Tribeca AI Storytelling", creator: "NYC AI Doc Collective", type: "SHORT_FILM", synopsis: "documentary AI reconstructions" },
  { id: 34, title: "Critic's Choice AI Short", creator: "Art House AI", type: "SHORT_FILM", synopsis: "critically acclaimed niche" },
  { id: 35, title: "Niche Masterpiece", creator: "Experimental AI Lab", type: "SHORT_FILM", synopsis: "perfect ratings small audience" },
  { id: 36, title: "Rising Star AI Film", creator: "New Wave AI", type: "SHORT_FILM", synopsis: "rapid growth views" },
  { id: 37, title: "Breakout AI Film", creator: "Social AI Studios", type: "SHORT_FILM", synopsis: "breakout social media" },
  { id: 38, title: "Undiscovered AI Classic", creator: "Pioneer AI Filmmaker", type: "SHORT_FILM", synopsis: "early AI film overlooked" },
  { id: 39, title: "Artisan AI Film", creator: "Artisan AI Collective", type: "SHORT_FILM", synopsis: "hand-crafted unique style" },
  { id: 40, title: "Many Ratings Stable", creator: "Popular AI Studio", type: "SHORT_FILM", synopsis: "popular thousands ratings" },
  { id: 41, title: "Multi-Platform AI Film", creator: "Multi-Platform AI", type: "SHORT_FILM", synopsis: "YouTube Vimeo multi-platform" },
  { id: 42, title: "Festival Only Release", creator: "Festival Exclusive AI", type: "SHORT_FILM", synopsis: "festival circuit limited" },
  { id: 43, title: "AI Series - Season 1", creator: "Space AI Studios", type: "SERIES", synopsis: "space exploration series" },
  { id: 44, title: "Documentary AI Reconstruction", creator: "History AI Lab", type: "DOCUMENTARY", synopsis: "historical events synthetic" },
  { id: 45, title: "Feature Length AI Film", creator: "Future AI Cinema", type: "FEATURE_FILM", synopsis: "future human-AI collaboration" },
];

// Color palettes - each work gets a unique palette based on its ID
const palettes = [
  ['#1a1a2e', '#16213e', '#0f3460'], // Deep blue
  ['#0d0d0d', '#1a0a1a', '#330033'], // Dark purple
  ['#0a1f1f', '#103535', '#1a5050'], // Teal
  ['#1a0505', '#2d0a0a', '#4d1505'], // Dark red
  ['#050a1a', '#0a1535', '#152a55'], // Navy
  ['#1a1a05', '#2d2d0a', '#4d4d15'], // Gold
  ['#050a05', '#0a1a0a', '#153515'], // Forest green
  ['#1a0505', '#350505', '#550a0a'], // Burgundy
  ['#0a0a0a', '#1a1a2e', '#2e2e4d'], // Midnight
  ['#1f1f0a', '#3d3d15', '#5e5e1f'], // Amber
  ['#0a051a', '#150a35', '#2a1555'], // Indigo
  ['#050a0a', '#0a1535', '#152a55'], // Steel blue
  ['#1a050f', '#2d0a1f', '#4d1535'], // Magenta
  ['#0a1a05', '#15350a', '#2a5515'], // Olive
  ['#1f0a05', '#3d150a', '#5e2515'], // Rust
  ['#0505 0a', '#0a0a1a', '#15152e'], // Onyx
  ['#1a0f05', '#2d1f0a', '#4d3515'], // Bronze
  ['#050a1f', '#0a1555', '#152a85'], // Royal blue
  ['#0a050a', '#1a0a1a', '#2e152e'], // Plum
  ['#0a1f0a', '#0a3515', '#155525'], // Emerald
  ['#1f0505', '#350a0a', '#551515'], // Crimson
  ['#050f0a', '#0a2a15', '#153525'], // Pine
  ['#1a0a15', '#2d152a', '#4d2540'], // Maroon
  ['#0a0510', '#150a25', '#251540'], // Violet
  ['#1a1505', '#2d2510', '#4d3f20'], // Sepia
  ['#050a15', '#0a1535', '#152555'], // Cobalt
  ['#0d1a05', '#1a3510', '#2a5520'], // Moss
  ['#1f050f', '#3d0a1f', '#5e1535'], // Rose
  ['#0a150f', '#152a1f', '#25403a'], // Slate
  ['#1a0510', '#2e0a20', '#4e1540'], // Orchid
  ['#050f1a', '#0a1f35', '#152f5e'], // Azure
  ['#1a1005', '#2e2010', '#4e3520'], // Chestnut
  ['#0a0a1f', '#15152e', '#25254d'], // Indigo dark
  ['#1f050a', '#350a15', '#551525'], // Ruby
  ['#0a0f05', '#151f10', '#253a20'], // Jade
  ['#1a051a', '#2e0a2e', '#4e1550'], // Amethyst
  ['#050f0a', '#0a1f15', '#152a25']], //Teal dark

function getColorPalette(id) {
  return palettes[id % palettes.length];
}

function escapeXml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function truncateTitle(title, maxLen) {
  if (title.length <= maxLen) return title;
  return title.substring(0, maxLen - 1) + '…';
}

function generateSvgPoster(work) {
  const [c1, c2, c3] = getColorPalette(work.id);
  const w = 200, h = 280;

  // Decorative pattern based on work ID
  const patternId = `pattern_${work.id}`;
  const seed = work.id * 137;
  const circleCount = 3 + (work.id % 5);
  let circles = '';
  for (let i = 0; i < circleCount; i++) {
    const cx = (seed * (i + 1) * 7) % w;
    const cy = (seed * (i + 1) * 13) % h;
    const r = 15 + ((seed * (i + 1)) % 40);
    const opacity = 0.05 + ((i * 3) % 15) / 100;
    circles += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="white" opacity="${opacity}"/>`;
  }

  // Type badge
  const typeLabel = work.type === 'SHORT_FILM' ? 'SHORT FILM' :
                    work.type === 'FEATURE_FILM' ? 'FEATURE FILM' :
                    work.type === 'DOCUMENTARY' ? 'DOCUMENTARY' :
                    work.type === 'SERIES' ? 'SERIES' : work.type;

  // Title font size based on title length
  const titleLen = work.title.length;
  const titleFontSize = titleLen > 25 ? 14 : titleLen > 15 ? 17 : 20;
  const titleLines = wrapText(work.title, 18);
  const titleY = h / 2 - (titleLines.length - 1) * (titleFontSize + 2) / 2 + 10;

  // Creator name
  const creator = work.creator || 'Unknown';

  // Geometric accent shapes
  const accentShape = getAccentShape(work.id, w, h, c3);

  // Build SVG
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="grad_${work.id}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${c1}"/>
      <stop offset="50%" style="stop-color:${c2}"/>
      <stop offset="100%" style="stop-color:${c3}"/>
    </linearGradient>
    <linearGradient id="overlay_${work.id}" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:${c1};stop-opacity:0"/>
      <stop offset="60%" style="stop-color:${c1};stop-opacity:0.3"/>
      <stop offset="100%" style="stop-color:${c1};stop-opacity:0.9"/>
    </linearGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#grad_${work.id})"/>
  ${accentShape}
  ${circles}
  <rect width="${w}" height="${h}" fill="url(#overlay_${work.id})"/>
  <!-- Type badge -->
  <rect x="10" y="10" width="${typeLabel.length * 7 + 10}" height="18" rx="3" fill="white" opacity="0.15"/>
  <text x="15" y="22" font-family="Arial,sans-serif" font-size="9" font-weight="bold" fill="white" opacity="0.7" letter-spacing="1">${escapeXml(typeLabel)}</text>
  <!-- Decorative line -->
  <line x1="15" y1="${titleY - 15}" x2="${w - 15}" y2="${titleY - 15}" stroke="white" stroke-width="1" opacity="0.2"/>
  <!-- Title -->
  ${titleLines.map((line, i) => `<text x="${w/2}" y="${titleY + i * (titleFontSize + 4)}" font-family="Arial,sans-serif" font-size="${titleFontSize}" font-weight="bold" fill="white" text-anchor="middle" opacity="0.95">${escapeXml(line)}</text>`).join('\n  ')}
  <!-- Creator -->
  <text x="${w/2}" y="${h - 35}" font-family="Arial,sans-serif" font-size="10" fill="white" text-anchor="middle" opacity="0.6">${escapeXml(creator)}</text>
  <!-- Bottom accent line -->
  <rect x="0" y="${h - 5}" width="${w}" height="5" fill="${c3}" opacity="0.8"/>
</svg>`;
  return svg;
}

function wrapText(text, maxChars) {
  const words = text.split(' ');
  const lines = [];
  let current = '';
  for (const word of words) {
    if ((current + ' ' + word).length > maxChars) {
      if (current) lines.push(current);
      current = word;
    } else {
      current = current ? current + ' ' + word : word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function getAccentShape(id, w, h, color) {
  const shapeType = id % 6;
  switch (shapeType) {
    case 0: // Diagonal stripes
      return `<polygon points="0,0 ${w*0.6},0 0,${h*0.6}" fill="${color}" opacity="0.15"/>`;
    case 1: // Triangle bottom right
      return `<polygon points="${w},${h} ${w},0 ${w*0.4},${h}" fill="${color}" opacity="0.15"/>`;
    case 2: // Circle center large
      return `<circle cx="${w/2}" cy="${h/2}" r="${h/3}" fill="none" stroke="${color}" stroke-width="2" opacity="0.2"/>`;
    case 3: // Hexagon
      const cx = w/2, cy = h/2, r = 50;
      return `<polygon points="${cx},${cy-r} ${cx+r*0.866},${cy-r/2} ${cx+r*0.866},${cy+r/2} ${cx},${cy+r} ${cx-r*0.866},${cy+r/2} ${cx-r*0.866},${cy-r/2}" fill="none" stroke="${color}" stroke-width="1.5" opacity="0.2"/>`;
    case 4: // Wavy lines
      return `<path d="M 0 ${h*0.3} Q ${w/4} ${h*0.2} ${w/2} ${h*0.3} T ${w} ${h*0.3}" fill="none" stroke="${color}" stroke-width="1.5" opacity="0.2"/><path d="M 0 ${h*0.7} Q ${w/4} ${h*0.6} ${w/2} ${h*0.7} T ${w} ${h*0.7}" fill="none" stroke="${color}" stroke-width="1.5" opacity="0.2"/>`;
    case 5: // Grid pattern
      let grid = '';
      for (let i = 1; i < 5; i++) grid += `<line x1="${i*w/5}" y1="0" x2="${i*w/5}" y2="${h}" stroke="${color}" stroke-width="0.5" opacity="0.1"/>`;
      for (let j = 1; j < 7; j++) grid += `<line x1="0" y1="${j*h/7}" x2="${w}" y2="${j*h/7}" stroke="${color}" stroke-width="0.5" opacity="0.1"/>`;
      return grid;
  }
  return '';
}

// Convert SVG to base64 data URL
function svgToDataUrl(svg) {
  const base64 = Buffer.from(svg, 'utf8').toString('base64');
  return `data:image/svg+xml;base64,${base64}`;
}

// Generate all posters
console.log('Generating unique SVG posters for all works...\n');

const updates = works.map(work => {
  const svg = generateSvgPoster(work);
  const dataUrl = svgToDataUrl(svg);
  return { id: work.id, title: work.title, posterUrl: dataUrl };
});

// Output as SQL
const fs = require('fs');
const sqlLines = [];

for (const update of updates) {
  // Use parameterized query via SQL string (D1 wrangler doesn't support params in --command)
  // We need to escape single quotes in the data URL
  const escapedUrl = update.posterUrl.replace(/'/g, "''");
  sqlLines.push(`UPDATE works SET poster_url = '${escapedUrl}' WHERE id = ${update.id};`);
}

const sql = sqlLines.join('\n');

// Write to file
fs.writeFileSync('d:/R/ai-film-chart/backend/src/scripts/update-posters.sql', sql);
console.log(`Generated ${updates.length} unique SVG posters`);
console.log('SQL written to update-posters.sql');
console.log(`\nSample (work 1): ${updates[0].posterUrl.substring(0, 100)}...`);
