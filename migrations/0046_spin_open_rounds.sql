CREATE TABLE composer_spin_open_rounds (
  session_id TEXT NOT NULL REFERENCES composer_spin_sessions(id) ON DELETE CASCADE,
  round_index INTEGER NOT NULL,
  winner INTEGER NOT NULL,
  spun_at INTEGER NOT NULL,
  PRIMARY KEY (session_id, round_index)
);

CREATE TRIGGER composer_spin_count_open_round
AFTER INSERT ON composer_spin_open_rounds
BEGIN
  UPDATE composer_spin_sessions SET revision = revision + 1 WHERE id = NEW.session_id;
END;
