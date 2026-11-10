-- Persist GitHub Projects Status option color (enum only) at board link time (page 08).
-- Used by issue screens 07/11–15 as the shared board-status color SoT.

ALTER TABLE board_status_mappings
    ADD COLUMN color varchar(16) NOT NULL DEFAULT 'GRAY'
        CHECK (color IN ('BLUE','GRAY','GREEN','ORANGE','PINK','PURPLE','RED','YELLOW'));

ALTER TABLE board_status_mappings
    ALTER COLUMN color DROP DEFAULT;
