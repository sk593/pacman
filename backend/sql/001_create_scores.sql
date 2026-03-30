CREATE TABLE IF NOT EXISTS scores (
    id            SERIAL PRIMARY KEY,
    player_name   VARCHAR(10) NOT NULL CHECK (char_length(trim(player_name)) >= 1),
    score         INTEGER NOT NULL CHECK (score > 0),
    level_reached INTEGER NOT NULL CHECK (level_reached >= 1),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scores_desc ON scores (score DESC);

CREATE TABLE IF NOT EXISTS themes (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(50) NOT NULL,
    description     VARCHAR(200) NOT NULL DEFAULT '',
    wall_color      VARCHAR(7) NOT NULL DEFAULT '#2121DE',
    pellet_color    VARCHAR(7) NOT NULL DEFAULT '#FFCC00',
    pacman_color    VARCHAR(7) NOT NULL DEFAULT '#FFFF00',
    background_color VARCHAR(7) NOT NULL DEFAULT '#000000',
    ghost1_name     VARCHAR(30) NOT NULL DEFAULT 'Blinky',
    ghost2_name     VARCHAR(30) NOT NULL DEFAULT 'Pinky',
    ghost3_name     VARCHAR(30) NOT NULL DEFAULT 'Inky',
    ghost4_name     VARCHAR(30) NOT NULL DEFAULT 'Clyde',
    ghost1_color    VARCHAR(7) NOT NULL DEFAULT '#FF0000',
    ghost2_color    VARCHAR(7) NOT NULL DEFAULT '#FFB8FF',
    ghost3_color    VARCHAR(7) NOT NULL DEFAULT '#00FFFF',
    ghost4_color    VARCHAR(7) NOT NULL DEFAULT '#FFB852',
    wall_sprite     VARCHAR(10) NOT NULL DEFAULT '',
    pellet_sprite   VARCHAR(10) NOT NULL DEFAULT '',
    pacman_sprite   VARCHAR(10) NOT NULL DEFAULT '',
    power_pellet_sprite VARCHAR(10) NOT NULL DEFAULT '',
    ghost1_sprite   VARCHAR(10) NOT NULL DEFAULT '',
    ghost2_sprite   VARCHAR(10) NOT NULL DEFAULT '',
    ghost3_sprite   VARCHAR(10) NOT NULL DEFAULT '',
    ghost4_sprite   VARCHAR(10) NOT NULL DEFAULT '',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed the classic theme if not present
INSERT INTO themes (name, description, wall_color, pellet_color, pacman_color, background_color,
                    ghost1_name, ghost2_name, ghost3_name, ghost4_name,
                    ghost1_color, ghost2_color, ghost3_color, ghost4_color)
SELECT 'Classic', 'The original Pac-Man colors',
       '#2121DE', '#FFCC00', '#FFFF00', '#000000',
       'Blinky', 'Pinky', 'Inky', 'Clyde',
       '#FF0000', '#FFB8FF', '#00FFFF', '#FFB852'
WHERE NOT EXISTS (SELECT 1 FROM themes WHERE name = 'Classic');
