package com.linker.backend.service.admin;

import java.sql.Timestamp;
import java.time.Instant;

import com.linker.backend.entity.chat.ChatMessage;
import com.linker.backend.entity.moderation.type.AdminActionType;
import com.linker.backend.entity.moderation.type.ReportTargetType;
import com.linker.backend.global.error.ApiException;
import com.linker.backend.repository.chat.ChatMessageRepository;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Applies an operator hide, delete, or restore to the reported row.
 * Posts, comments, recruit posts, and ads are updated only when their tables exist.
 */
@Component
public class ReportContentEffects {

	private final ChatMessageRepository messages;
	private final JdbcTemplate jdbc;

	public ReportContentEffects(ChatMessageRepository messages, JdbcTemplate jdbc) {
		this.messages = messages;
		this.jdbc = jdbc;
	}

	public void apply(ReportTargetType type, long targetId, AdminActionType action, Instant now) {
		if (action == AdminActionType.DISMISS || type == ReportTargetType.USER) {
			return;
		}
		switch (type) {
			case TEAM_MESSAGE, DM_MESSAGE -> chat(targetId, action, now);
			case POST -> visibility("posts", targetId, action, now);
			case COMMENT -> visibility("comments", targetId, action, now);
			case RECRUIT_POST -> visibility("recruit_posts", targetId, action, now);
			case RECRUITER_AD -> ad(targetId, action, now);
			case USER -> {
			}
		}
	}

	private void chat(long targetId, AdminActionType action, Instant now) {
		ChatMessage message = messages.lockById(targetId)
				.orElseThrow(this::missing);
		switch (action) {
			case HIDE -> message.hide();
			case DELETE -> {
				message.hide();
				message.delete(now);
			}
			case RESTORE -> message.restore();
			default -> {
			}
		}
	}

	private void visibility(String table, long targetId, AdminActionType action, Instant now) {
		if (!ready(table, "id", "visibility", "deleted_at")) {
			return;
		}
		String sql = switch (table) {
			case "posts" -> "update posts set visibility = ?, deleted_at = ? where id = ?";
			case "comments" -> "update comments set visibility = ?, deleted_at = ? where id = ?";
			case "recruit_posts" -> "update recruit_posts set visibility = ?, deleted_at = ? where id = ?";
			default -> throw new IllegalStateException(table);
		};
		String visibility = action == AdminActionType.RESTORE ? "VISIBLE" : "HIDDEN";
		Timestamp deletedAt = action == AdminActionType.DELETE ? Timestamp.from(now) : null;
		if (jdbc.update(sql, visibility, deletedAt, targetId) == 0) {
			throw missing();
		}
	}

	private void ad(long targetId, AdminActionType action, Instant now) {
		if (!ready("recruiter_ads", "id", "status")) {
			return;
		}
		String status = action == AdminActionType.RESTORE ? "ACTIVE" : "HIDDEN";
		int updated;
		if (ready("recruiter_ads", "hidden_at") && ready("recruiter_ads", "deleted_at")) {
			Timestamp hidden = action == AdminActionType.RESTORE ? null : Timestamp.from(now);
			Timestamp deleted = action == AdminActionType.DELETE ? Timestamp.from(now) : null;
			updated = jdbc.update(
					"update recruiter_ads set status = ?, hidden_at = ?, deleted_at = ? where id = ?",
					status, hidden, deleted, targetId);
		}
		else {
			updated = jdbc.update("update recruiter_ads set status = ? where id = ?", status, targetId);
		}
		if (updated == 0) {
			throw missing();
		}
	}

	private boolean ready(String table, String... columns) {
		Boolean exists = jdbc.queryForObject(
				"select to_regclass('public." + table + "') is not null", Boolean.class);
		if (!Boolean.TRUE.equals(exists)) {
			return false;
		}
		for (String column : columns) {
			Integer count = jdbc.queryForObject("""
					select count(*) from information_schema.columns
					where table_schema = 'public' and table_name = ? and column_name = ?
					""", Integer.class, table, column);
			if (count == null || count == 0) {
				return false;
			}
		}
		return true;
	}

	private ApiException missing() {
		return new ApiException(404, "NOT_FOUND", "신고 대상을 찾을 수 없어요");
	}
}
