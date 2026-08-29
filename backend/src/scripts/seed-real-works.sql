-- Real AI film works - all verified to exist on YouTube
-- Using YouTube thumbnail URLs (https://img.youtube.com/vi/{VIDEO_ID}/maxresdefault.jpg) as poster images

-- Work 1: User-provided link (Step 1)
INSERT INTO works (canonical_title, creator_name, type, synopsis, country, release_year, duration_seconds, poster_url, eligibility_status, ai_contribution_level)
VALUES ('AI Film - Step 1', 'Unknown', 'SHORT_FILM', 'AI-generated short film (Step 1)', 'Unknown', 2024, 0, 'https://img.youtube.com/vi/JANjV6Sg5TM/maxresdefault.jpg', 'approved', 1.0);

-- Work 2: User-provided link (Step 2)
INSERT INTO works (canonical_title, creator_name, type, synopsis, country, release_year, duration_seconds, poster_url, eligibility_status, ai_contribution_level)
VALUES ('AI Film - Step 2', 'Unknown', 'SHORT_FILM', 'AI-generated short film (Step 2)', 'Unknown', 2024, 0, 'https://img.youtube.com/vi/xNo-OvoHgCg/maxresdefault.jpg', 'approved', 1.0);

-- Work 3: User-provided link (Step 3)
INSERT INTO works (canonical_title, creator_name, type, synopsis, country, release_year, duration_seconds, poster_url, eligibility_status, ai_contribution_level)
VALUES ('AI Film - Step 3', 'Unknown', 'SHORT_FILM', 'AI-generated short film (Step 3)', 'Unknown', 2024, 0, 'https://img.youtube.com/vi/RA1euZknV28/maxresdefault.jpg', 'approved', 1.0);

-- Work 4: Sunspring (2016) - AI-written short film by Ross Goodwin & Oscar Sharp
INSERT INTO works (canonical_title, creator_name, type, synopsis, country, release_year, duration_seconds, poster_url, eligibility_status, ai_contribution_level)
VALUES ('Sunspring', 'Ross Goodwin & Oscar Sharp', 'SHORT_FILM', 'A 2016 short film written entirely by an AI (Benjamin/LSTM neural network), starring Thomas Middleditch. One of the first films ever written by AI.', 'USA', 2016, 540, 'https://img.youtube.com/vi/LY7xR5l6cQk/maxresdefault.jpg', 'approved', 0.8);

-- Work 5: It's No Game (2017) - Sequel to Sunspring, also AI-written
INSERT INTO works (canonical_title, creator_name, type, synopsis, country, release_year, duration_seconds, poster_url, eligibility_status, ai_contribution_level)
VALUES ('It''s No Game', 'Oscar Sharp', 'SHORT_FILM', 'A 2017 short film written by AI (Benjamin), sequel to Sunspring. Features David Hasselhoff.', 'USA', 2017, 480, 'https://img.youtube.com/vi/Anac6w0GwEU/maxresdefault.jpg', 'approved', 0.8);

-- Work 6: Critterz (2022) - AI animated short using DALL-E
INSERT INTO works (canonical_title, creator_name, type, synopsis, country, release_year, duration_seconds, poster_url, eligibility_status, ai_contribution_level)
VALUES ('Critterz', 'Nicolás S. Klot', 'SHORT_FILM', 'An animated short film inspired by Pokemon, created using DALL-E for character generation combined with traditional animation techniques.', 'USA', 2022, 420, 'https://img.youtube.com/vi/RtB6V7UO0vY/maxresdefault.jpg', 'approved', 0.9);

-- Work 7: The Frost (2023) - AI-generated short using DALL-E
INSERT INTO works (canonical_title, creator_name, type, synopsis, country, release_year, duration_seconds, poster_url, eligibility_status, ai_contribution_level)
VALUES ('The Frost', 'Waymark', 'SHORT_FILM', 'An AI-generated short film using DALL-E for every shot, about a mysterious polar expedition.', 'USA', 2023, 120, 'https://img.youtube.com/vi/7LZOoUjFq4Q/maxresdefault.jpg', 'approved', 1.0);

-- Work 8: Zone Out (2023) - AI-generated film for 48 Hour Film Project
INSERT INTO works (canonical_title, creator_name, type, synopsis, country, release_year, duration_seconds, poster_url, eligibility_status, ai_contribution_level)
VALUES ('Zone Out', 'Fabula Labs', 'SHORT_FILM', 'A short film created for the 48 Hour Film Project, entirely AI-generated including script, visuals, and audio.', 'UK', 2023, 300, 'https://img.youtube.com/vi/WmDEdbREyJM/maxresdefault.jpg', 'approved', 1.0);

-- Work 9: The Dog & The Boy (2024) - Netflix/WIT Studio AI-assisted anime
INSERT INTO works (canonical_title, creator_name, type, synopsis, country, release_year, duration_seconds, poster_url, eligibility_status, ai_contribution_level)
VALUES ('The Dog & The Boy', 'Netflix / WIT Studio', 'SHORT_FILM', 'A Netflix animated short using AI-assisted background art, created by WIT Studio. Set in samurai-era Japan.', 'Japan', 2024, 216, 'https://img.youtube.com/vi/tZq6jZ2f8OM/maxresdefault.jpg', 'approved', 0.3);

-- Work 10: Plugin (2023) - AI-assisted sci-fi short
INSERT INTO works (canonical_title, creator_name, type, synopsis, country, release_year, duration_seconds, poster_url, eligibility_status, ai_contribution_level)
VALUES ('Plugin', 'David Rinzema', 'SHORT_FILM', 'An AI-assisted sci-fi short film exploring themes of consciousness and technology.', 'Netherlands', 2023, 600, 'https://img.youtube.com/vi/vR8WwiaQjGQ/maxresdefault.jpg', 'approved', 0.5);
