/**
 * Seed unique poster images for all works
 * Uses Unsplash Source API with unique keywords per work
 */

const http = require('http');
const https = require('https');

// All 45 works with unique search keywords for poster images
const works = [
  { id: 1, title: "Echoes of Tomorrow", keywords: "memory,identity,film" },
  { id: 2, title: "Neon Nights", keywords: "cyberpunk,neon,city,night" },
  { id: 3, title: "The Glitch in Paradise", keywords: "glitch,surreal,digital" },
  { id: 4, title: "Paper Hearts", keywords: "origami,paper,art" },
  { id: 5, title: "Beyond the Screen", keywords: "computer,love,technology" },
  { id: 6, title: "Chromatic Aberration", keywords: "colorful,abstract,color" },
  { id: 7, title: "Voices from the Static", keywords: "vintage,tv,static" },
  { id: 8, title: "The Final Canvas", keywords: "painting,artist,canvas" },
  { id: 9, title: "Dust and Stars", keywords: "mars,astronaut,space" },
  { id: 10, title: "The Archive", keywords: "archive,museum,history" },
  { id: 11, title: "The Last Library", keywords: "library,books,apocalyptic" },
  { id: 12, title: "Symphony of Data", keywords: "orchestra,music,data" },
  { id: 13, title: "The Last Human", keywords: "lonely,survivor,future" },
  { id: 14, title: "The Painter's Algorithm", keywords: "painting,algorithm,art" },
  { id: 15, title: "Bloom", keywords: "flower,bloom,nature" },
  { id: 16, title: "Codebreaker", keywords: "vintage,typewriter,code" },
  { id: 17, title: "The Reset Button", keywords: "button,reset,comedy" },
  { id: 18, title: "Midjourney Cinema Vol. 1", keywords: "cinematic,ai,art" },
  { id: 19, title: "Runway Gen-2 Showcase", keywords: "runway,fashion,showcase" },
  { id: 20, title: "Stable Video Diffusion Art", keywords: "abstract,motion,color" },
  { id: 21, title: "Kling AI Cinematic", keywords: "cinematic,film,camera" },
  { id: 22, title: "Hailuo AI Mini Cinema", keywords: "miniature,cinema,story" },
  { id: 23, title: "CogVideo Showcase", keywords: "academic,video,technology" },
  { id: 24, title: "AnimateDiff Cinema", keywords: "animation,diffusion,art" },
  { id: 25, title: "Sundance AI Shorts Winner", keywords: "sundance,film,festival" },
  { id: 26, title: "Cannes AI Film Corner Winner", keywords: "cannes,film,award" },
  { id: 27, title: "Berlinale AI Forum Finalist", keywords: "berlin,film,forum" },
  { id: 28, title: "Venice AI Biennale Winner", keywords: "venice,art,biennale" },
  { id: 29, title: "TIFF AI Showcase", keywords: "toronto,film,festival" },
  { id: 30, title: "Busan AI Film Festival Winner", keywords: "korea,film,festival" },
  { id: 31, title: "Rotterdam AI Art Prize", keywords: "rotterdam,art,prize" },
  { id: 32, title: "SXSW AI Film Award", keywords: "austin,texas,music,film" },
  { id: 33, title: "Tribeca AI Storytelling Winner", keywords: "nyc,storytelling,film" },
  { id: 34, title: "Critic's Choice AI Short", keywords: "cinema,critique,art" },
  { id: 35, title: "Niche Masterpiece", keywords: "masterpiece,art,niche" },
  { id: 36, title: "Rising Star AI Film", keywords: "rising,star,bright" },
  { id: 37, title: "Breakout AI Film", keywords: "breakout,social,viral" },
  { id: 38, title: "Undiscovered AI Classic", keywords: "classic,vintage,film" },
  { id: 39, title: "Artisan AI Film", keywords: "handcraft,artisan,art" },
  { id: 40, title: "Many Ratings Stable Score", keywords: "popular,crowd,film" },
  { id: 41, title: "Multi-Platform AI Film", keywords: "platform,digital,media" },
  { id: 42, title: "Festival Only Release", keywords: "festival,cinema,red,carpet" },
  { id: 43, title: "AI Series - Season 1", keywords: "space,exploration,series" },
  { id: 44, title: "Documentary AI Reconstruction", keywords: "documentary,history,archive" },
  { id: 45, title: "Feature Length AI Film", keywords: "future,ai,cinema,epic" },
];

// Use picsum.photos with unique seeds - reliable and always returns a unique image
function getPosterUrl(work) {
  // Use picsum.photos with the work ID as seed for consistent unique images
  return `https://picsum.photos/seed/${work.id}_${work.keywords.split(',')[0]}/200/280`;
}

// Generate SQL to update all posters
const sqlStatements = works.map(w => {
  const url = getPosterUrl(w);
  return `UPDATE works SET poster_url = '${url}' WHERE id = ${w.id};`;
});

console.log('Generated SQL:');
sqlStatements.forEach(s => console.log(s));

// Also output as a single SQL for batch execution
const batchSql = sqlStatements.join('\n');
console.log('\n\nBatch SQL:');
console.log(batchSql);
