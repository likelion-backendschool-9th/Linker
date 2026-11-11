-- POL-P-2: project post tags are free text typed on 22 ("#을 기준으로 태그를 나눠주세요"), not picks from
-- the tech stack catalog. post_tags keeps the name itself instead of a tech_tags reference.
ALTER TABLE post_tags ADD COLUMN name varchar(40);

UPDATE post_tags pt
SET name = t.name
FROM tech_tags t
WHERE t.id = pt.tag_id;

ALTER TABLE post_tags ALTER COLUMN name SET NOT NULL;

ALTER TABLE post_tags DROP CONSTRAINT post_tags_post_tag_uk;
ALTER TABLE post_tags DROP CONSTRAINT post_tags_tag_id_fk;
DROP INDEX post_tags_tag_id_idx;
ALTER TABLE post_tags DROP COLUMN tag_id;

ALTER TABLE post_tags ADD CONSTRAINT post_tags_post_name_uk UNIQUE (post_id, name);
