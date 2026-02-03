-- FTS5 full-text search for chat messages (AI assistant conversations)
-- Indexes content and denormalized session_title for search
-- Excludes system role messages from index (system prompts pollute results)
CREATE VIRTUAL TABLE `chat_messages_fts` USING fts5(
	content,
	session_title,
	content=chat_messages,
	content_rowid=rowid
);--> statement-breakpoint
CREATE TRIGGER chat_messages_fts_ai AFTER INSERT ON `chat_messages` BEGIN
	INSERT INTO chat_messages_fts(rowid, content, session_title)
	SELECT new.rowid, new.content,
		COALESCE((SELECT title FROM chat_sessions WHERE id = new.session_id), '')
	WHERE new.role != 'system';
END;--> statement-breakpoint
CREATE TRIGGER chat_messages_fts_ad AFTER DELETE ON `chat_messages` BEGIN
	INSERT INTO chat_messages_fts(chat_messages_fts, rowid, content, session_title)
	SELECT 'delete', old.rowid, old.content,
		COALESCE((SELECT title FROM chat_sessions WHERE id = old.session_id), '')
	WHERE old.role != 'system';
END;--> statement-breakpoint
CREATE TRIGGER chat_messages_fts_au AFTER UPDATE ON `chat_messages` BEGIN
	INSERT INTO chat_messages_fts(chat_messages_fts, rowid, content, session_title)
	SELECT 'delete', old.rowid, old.content,
		COALESCE((SELECT title FROM chat_sessions WHERE id = old.session_id), '')
	WHERE old.role != 'system';
	INSERT INTO chat_messages_fts(rowid, content, session_title)
	SELECT new.rowid, new.content,
		COALESCE((SELECT title FROM chat_sessions WHERE id = new.session_id), '')
	WHERE new.role != 'system';
END;--> statement-breakpoint
-- Backfill chat_messages_fts from existing data (excluding system messages)
INSERT INTO chat_messages_fts(rowid, content, session_title)
SELECT m.rowid, m.content,
	COALESCE((SELECT title FROM chat_sessions WHERE id = m.session_id), '')
FROM chat_messages m
WHERE m.role != 'system';
