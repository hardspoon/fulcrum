CREATE TABLE `memories` (
	`id` text PRIMARY KEY NOT NULL,
	`content` text NOT NULL,
	`tags` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);--> statement-breakpoint
CREATE VIRTUAL TABLE `memories_fts` USING fts5(
	content,
	tags,
	content=memories,
	content_rowid=rowid
);--> statement-breakpoint
CREATE TRIGGER memories_ai AFTER INSERT ON `memories` BEGIN
	INSERT INTO memories_fts(rowid, content, tags)
	VALUES (new.rowid, new.content, new.tags);
END;--> statement-breakpoint
CREATE TRIGGER memories_ad AFTER DELETE ON `memories` BEGIN
	INSERT INTO memories_fts(memories_fts, rowid, content, tags)
	VALUES ('delete', old.rowid, old.content, old.tags);
END;--> statement-breakpoint
CREATE TRIGGER memories_au AFTER UPDATE ON `memories` BEGIN
	INSERT INTO memories_fts(memories_fts, rowid, content, tags)
	VALUES ('delete', old.rowid, old.content, old.tags);
	INSERT INTO memories_fts(rowid, content, tags)
	VALUES (new.rowid, new.content, new.tags);
END;
