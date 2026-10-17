-- Forward repair for databases where 0004 was applied after stacks had already
-- been published. Retain original publication identities/times, existing
-- history, private drafts and lifecycle state. Re-running this is harmless.
INSERT OR IGNORE INTO creator_stack_publications (stack_id, revision, document_json, published_at)
SELECT id, published_revision, published_json, COALESCE(published_at, updated_at, created_at)
FROM creator_stacks
WHERE typeof(published_revision) = 'integer' AND published_revision >= 1
  AND published_revision <= revision
  AND CASE WHEN json_valid(published_json) THEN
    json_type(published_json) = 'object'
    AND json_extract(published_json, '$.version') = 1
    AND json_type(published_json, '$.name') = 'text'
    AND length(trim(json_extract(published_json, '$.name'))) BETWEEN 1 AND 80
    AND json_extract(published_json, '$.theme') IN ('daylight', 'midnight')
    AND json_type(published_json, '$.instances') = 'array'
    AND json_array_length(published_json, '$.instances') BETWEEN 1 AND 12
  ELSE 0 END;
