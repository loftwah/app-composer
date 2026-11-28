ALTER TABLE composer_decision_responses ADD COLUMN media TEXT NOT NULL DEFAULT '[]';
ALTER TABLE composer_decision_responses ADD COLUMN image_revision INTEGER;
ALTER TABLE composer_decision_responses ADD COLUMN image_name TEXT;
ALTER TABLE composer_decision_responses ADD COLUMN image_type TEXT;
ALTER TABLE composer_decision_responses ADD COLUMN image_data TEXT;
ALTER TABLE composer_decision_responses ADD COLUMN reaction TEXT CHECK (reaction IN ('useful', 'needs-work'));
