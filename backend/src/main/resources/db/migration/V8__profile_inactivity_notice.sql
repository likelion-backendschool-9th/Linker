-- Set when the inactivity batch turns job seeking off. Cleared when the next session read sends the notice.
ALTER TABLE users ADD COLUMN job_seeking_off_notice boolean NOT NULL DEFAULT false;
