-- FTS5 full-text search for tasks
CREATE VIRTUAL TABLE `tasks_fts` USING fts5(
	title,
	description,
	notes,
	tags,
	content=tasks,
	content_rowid=rowid
);--> statement-breakpoint
CREATE TRIGGER tasks_fts_ai AFTER INSERT ON `tasks` BEGIN
	INSERT INTO tasks_fts(rowid, title, description, notes, tags)
	VALUES (new.rowid, new.title, new.description, new.notes, '');
END;--> statement-breakpoint
CREATE TRIGGER tasks_fts_ad AFTER DELETE ON `tasks` BEGIN
	INSERT INTO tasks_fts(tasks_fts, rowid, title, description, notes, tags)
	VALUES ('delete', old.rowid, old.title, old.description, old.notes, '');
END;--> statement-breakpoint
CREATE TRIGGER tasks_fts_au AFTER UPDATE ON `tasks` BEGIN
	INSERT INTO tasks_fts(tasks_fts, rowid, title, description, notes, tags)
	VALUES ('delete', old.rowid, old.title, old.description, old.notes, '');
	INSERT INTO tasks_fts(rowid, title, description, notes, tags)
	VALUES (new.rowid, new.title, new.description, new.notes,
		COALESCE((SELECT GROUP_CONCAT(t.name, ' ') FROM task_tags tt JOIN tags t ON t.id = tt.tag_id WHERE tt.task_id = new.id), ''));
END;--> statement-breakpoint
-- Backfill tasks_fts from existing data
INSERT INTO tasks_fts(rowid, title, description, notes, tags)
SELECT t.rowid, t.title, t.description, t.notes,
	COALESCE((SELECT GROUP_CONCAT(tg.name, ' ') FROM task_tags tt JOIN tags tg ON tg.id = tt.tag_id WHERE tt.task_id = t.id), '')
FROM tasks t;--> statement-breakpoint

-- FTS5 full-text search for projects
CREATE VIRTUAL TABLE `projects_fts` USING fts5(
	name,
	description,
	notes,
	content=projects,
	content_rowid=rowid
);--> statement-breakpoint
CREATE TRIGGER projects_fts_ai AFTER INSERT ON `projects` BEGIN
	INSERT INTO projects_fts(rowid, name, description, notes)
	VALUES (new.rowid, new.name, new.description, new.notes);
END;--> statement-breakpoint
CREATE TRIGGER projects_fts_ad AFTER DELETE ON `projects` BEGIN
	INSERT INTO projects_fts(projects_fts, rowid, name, description, notes)
	VALUES ('delete', old.rowid, old.name, old.description, old.notes);
END;--> statement-breakpoint
CREATE TRIGGER projects_fts_au AFTER UPDATE ON `projects` BEGIN
	INSERT INTO projects_fts(projects_fts, rowid, name, description, notes)
	VALUES ('delete', old.rowid, old.name, old.description, old.notes);
	INSERT INTO projects_fts(rowid, name, description, notes)
	VALUES (new.rowid, new.name, new.description, new.notes);
END;--> statement-breakpoint
-- Backfill projects_fts
INSERT INTO projects_fts(rowid, name, description, notes)
SELECT rowid, name, description, notes FROM projects;--> statement-breakpoint

-- FTS5 full-text search for channel messages
CREATE VIRTUAL TABLE `channel_messages_fts` USING fts5(
	content,
	sender_name,
	subject,
	content=channel_messages,
	content_rowid=rowid
);--> statement-breakpoint
CREATE TRIGGER channel_messages_fts_ai AFTER INSERT ON `channel_messages` BEGIN
	INSERT INTO channel_messages_fts(rowid, content, sender_name, subject)
	VALUES (new.rowid, new.content, new.sender_name, COALESCE(json_extract(new.metadata, '$.subject'), ''));
END;--> statement-breakpoint
CREATE TRIGGER channel_messages_fts_ad AFTER DELETE ON `channel_messages` BEGIN
	INSERT INTO channel_messages_fts(channel_messages_fts, rowid, content, sender_name, subject)
	VALUES ('delete', old.rowid, old.content, old.sender_name, COALESCE(json_extract(old.metadata, '$.subject'), ''));
END;--> statement-breakpoint
CREATE TRIGGER channel_messages_fts_au AFTER UPDATE ON `channel_messages` BEGIN
	INSERT INTO channel_messages_fts(channel_messages_fts, rowid, content, sender_name, subject)
	VALUES ('delete', old.rowid, old.content, old.sender_name, COALESCE(json_extract(old.metadata, '$.subject'), ''));
	INSERT INTO channel_messages_fts(rowid, content, sender_name, subject)
	VALUES (new.rowid, new.content, new.sender_name, COALESCE(json_extract(new.metadata, '$.subject'), ''));
END;--> statement-breakpoint
-- Backfill channel_messages_fts
INSERT INTO channel_messages_fts(rowid, content, sender_name, subject)
SELECT rowid, content, sender_name, COALESCE(json_extract(metadata, '$.subject'), '')
FROM channel_messages;--> statement-breakpoint

-- FTS5 full-text search for calendar events
CREATE VIRTUAL TABLE `caldav_events_fts` USING fts5(
	summary,
	description,
	location,
	content=caldav_events,
	content_rowid=rowid
);--> statement-breakpoint
CREATE TRIGGER caldav_events_fts_ai AFTER INSERT ON `caldav_events` BEGIN
	INSERT INTO caldav_events_fts(rowid, summary, description, location)
	VALUES (new.rowid, new.summary, new.description, new.location);
END;--> statement-breakpoint
CREATE TRIGGER caldav_events_fts_ad AFTER DELETE ON `caldav_events` BEGIN
	INSERT INTO caldav_events_fts(caldav_events_fts, rowid, summary, description, location)
	VALUES ('delete', old.rowid, old.summary, old.description, old.location);
END;--> statement-breakpoint
CREATE TRIGGER caldav_events_fts_au AFTER UPDATE ON `caldav_events` BEGIN
	INSERT INTO caldav_events_fts(caldav_events_fts, rowid, summary, description, location)
	VALUES ('delete', old.rowid, old.summary, old.description, old.location);
	INSERT INTO caldav_events_fts(rowid, summary, description, location)
	VALUES (new.rowid, new.summary, new.description, new.location);
END;--> statement-breakpoint
-- Backfill caldav_events_fts
INSERT INTO caldav_events_fts(rowid, summary, description, location)
SELECT rowid, summary, description, location FROM caldav_events;
