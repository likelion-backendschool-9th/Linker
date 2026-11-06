package com.linker.backend.repository.chat;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import com.linker.backend.dto.chat.response.ChatShareCardResponse;
import com.linker.backend.entity.account.type.UserStatus;
import com.linker.backend.entity.post.type.PostVisibility;
import com.linker.backend.entity.recruit.type.RecruitVisibility;

import jakarta.persistence.EntityManager;
import jakarta.persistence.TypedQuery;

/**
 * Spring Data attaches this class to {@link ChatMessageRepository} by name, so it carries no
 * {@code @Repository}. The conditions are assembled in Java instead of binding nulls
 * ({@code team}, {@code historyStart}), which keeps the JPQL free of nullable-parameter casts.
 */
class ChatMessageRepositoryImpl implements ChatMessageRepositoryCustom {

	private static final String SELECT = """
			select m.id, m.room.id,
			  (select count(o) from ChatRoomMember o
			    where o.room.id = m.room.id
			      and o.leftAt is null
			      and (m.senderId is null or o.userId <> m.senderId)
			      and (o.lastReadMessageId is null or o.lastReadMessageId < m.id)),
			  m.clientMessageId, m.senderId, u.username, u.displayName, u.avatarUrl, u.status,
			  m.messageType, m.body, m.payload, m.visibility, m.deletedAt, m.createdAt, m.editedAt
			from ChatMessage m
			left join User u on u.id = m.senderId
			""";

	private static final String BLOCKED_PERIOD = """
			and (
			  m.senderId is null
			  or m.senderId = :viewer
			  or not exists (
			    select 1 from UserBlock b
			    where b.blockerId = :viewer
			      and b.blockedId = m.senderId
			      and b.createdAt <= m.createdAt
			      and (b.unblockedAt is null or b.unblockedAt > m.createdAt)
			  )
			)
			""";

	private static final String NO_BLOCK_BETWEEN = """
			not exists (
			  select 1 from UserBlock b
			  where b.unblockedAt is null
			    and ((b.blockerId = :viewer and b.blockedId = %s) or (b.blockerId = %s and b.blockedId = :viewer))
			)
			""";

	private final EntityManager em;

	ChatMessageRepositoryImpl(EntityManager em) {
		this.em = em;
	}

	@Override
	public List<ChatMessageRow> latest(long viewerId, long roomId, boolean team, Instant historyStart, int limit) {
		List<ChatMessageRow> rows = rows(SELECT + where(team, historyStart) + " order by m.id desc",
				viewerId, roomId, team, historyStart, null, limit);
		Collections.reverse(rows);
		return rows;
	}

	@Override
	public List<ChatMessageRow> before(long viewerId, long roomId, boolean team, Instant historyStart, long before, int limit) {
		List<ChatMessageRow> rows = rows(SELECT + where(team, historyStart) + " and m.id < :anchor order by m.id desc",
				viewerId, roomId, team, historyStart, before, limit);
		Collections.reverse(rows);
		return rows;
	}

	@Override
	public List<ChatMessageRow> after(long viewerId, long roomId, boolean team, Instant historyStart, long after, int limit) {
		return rows(SELECT + where(team, historyStart) + " and m.id > :anchor order by m.id asc",
				viewerId, roomId, team, historyStart, after, limit);
	}

	@Override
	public boolean visibleTo(long viewerId, long roomId, boolean team, Instant historyStart, long messageId) {
		return !rows(SELECT + where(team, historyStart) + " and m.id = :anchor",
				viewerId, roomId, team, historyStart, messageId, 1).isEmpty();
	}

	@Override
	public Map<Long, List<String>> imageUrls(Collection<Long> messageIds) {
		if (messageIds == null || messageIds.isEmpty()) {
			return Map.of();
		}
		List<Object[]> found = em.createQuery("""
				select i.message.id, f.url
				from ChatMessageImage i
				join i.file f
				where i.message.id in :ids
				  and f.url is not null
				order by i.message.id, i.sortOrder, i.id
				""", Object[].class)
				.setParameter("ids", messageIds)
				.getResultList();
		Map<Long, List<String>> urls = new LinkedHashMap<>();
		for (Object[] row : found) {
			urls.computeIfAbsent((Long) row[0], id -> new ArrayList<>()).add((String) row[1]);
		}
		return urls;
	}

	@Override
	public ChatShareCardResponse resolveShareCard(long viewerId, String targetType, long targetId) {
		return switch (targetType) {
			case "POST" -> postCard(viewerId, targetId);
			case "RECRUIT_POST" -> recruitCard(viewerId, targetId);
			case "PROFILE" -> profileCard(viewerId, targetId);
			default -> ChatShareCardResponse.unavailable(targetType, targetId);
		};
	}

	private ChatShareCardResponse postCard(long viewerId, long id) {
		List<Object[]> rows = em.createQuery("""
				select p.id, p.summary
				from Post p
				join p.author u
				where p.id = :id and p.deletedAt is null and p.visibility = :visible
				  and u.deletedAt is null and u.status <> :deleted
				  and\s""" + NO_BLOCK_BETWEEN.formatted("p.author.id", "p.author.id"), Object[].class)
				.setParameter("id", id)
				.setParameter("visible", PostVisibility.VISIBLE)
				.setParameter("deleted", UserStatus.DELETED)
				.setParameter("viewer", viewerId)
				.getResultList();
		if (rows.isEmpty()) {
			return ChatShareCardResponse.unavailable("POST", id);
		}
		// first image by sort order, even if its url is null (same as the single-row lookup before)
		List<String> images = em.createQuery("""
				select f.url from PostImage pi join pi.file f
				where pi.post.id = :id
				order by pi.sortOrder, pi.id
				""", String.class)
				.setParameter("id", id)
				.setMaxResults(1)
				.getResultList();
		long postId = (Long) rows.get(0)[0];
		return new ChatShareCardResponse(
				"POST", postId, (String) rows.get(0)[1], null,
				images.isEmpty() ? null : images.get(0), "/posts/" + postId + "?from=chat_share", true);
	}

	private ChatShareCardResponse recruitCard(long viewerId, long id) {
		List<Object[]> rows = em.createQuery("""
				select p.id, p.title, p.description
				from RecruitPost p
				join p.author u
				where p.id = :id and p.deletedAt is null and p.visibility = :visible
				  and u.deletedAt is null and u.status <> :deleted
				  and\s""" + NO_BLOCK_BETWEEN.formatted("p.author.id", "p.author.id"), Object[].class)
				.setParameter("id", id)
				.setParameter("visible", RecruitVisibility.VISIBLE)
				.setParameter("deleted", UserStatus.DELETED)
				.setParameter("viewer", viewerId)
				.getResultList();
		if (rows.isEmpty()) {
			return ChatShareCardResponse.unavailable("RECRUIT_POST", id);
		}
		Object[] row = rows.get(0);
		long postId = (Long) row[0];
		return new ChatShareCardResponse(
				"RECRUIT_POST", postId, (String) row[1], (String) row[2],
				null, "/recruits/" + postId + "?from=chat_share", true);
	}

	private ChatShareCardResponse profileCard(long viewerId, long id) {
		List<Object[]> rows = em.createQuery("""
				select u.id, u.username, coalesce(u.displayName, u.username), u.avatarUrl
				from User u
				where u.id = :id and u.deletedAt is null and u.status <> :deleted
				  and\s""" + NO_BLOCK_BETWEEN.formatted("u.id", "u.id"), Object[].class)
				.setParameter("id", id)
				.setParameter("deleted", UserStatus.DELETED)
				.setParameter("viewer", viewerId)
				.getResultList();
		if (rows.isEmpty()) {
			return ChatShareCardResponse.unavailable("PROFILE", id);
		}
		Object[] row = rows.get(0);
		return new ChatShareCardResponse(
				"PROFILE", (Long) row[0], (String) row[2], "@" + row[1],
				(String) row[3], "/users/" + row[1], true);
	}

	private static String where(boolean team, Instant historyStart) {
		StringBuilder where = new StringBuilder("where m.room.id = :room\n");
		if (historyStart != null) {
			where.append("and m.createdAt >= :historyStart\n");
		}
		if (!team) {
			where.append(BLOCKED_PERIOD);
		}
		return where.toString();
	}

	private List<ChatMessageRow> rows(
			String jpql, long viewerId, long roomId, boolean team, Instant historyStart, Long anchor, int limit
	) {
		TypedQuery<Object[]> query = em.createQuery(jpql, Object[].class).setParameter("room", roomId);
		if (historyStart != null) {
			query.setParameter("historyStart", historyStart);
		}
		if (!team) {
			query.setParameter("viewer", viewerId);
		}
		if (anchor != null) {
			query.setParameter("anchor", anchor);
		}
		return new ArrayList<>(query.setMaxResults(limit).getResultList().stream().map(ChatMessageRepositoryImpl::map).toList());
	}

	private static ChatMessageRow map(Object[] r) {
		return new ChatMessageRow(
				(Long) r[0],
				(Long) r[1],
				(Long) r[2],
				(String) r[3],
				(Long) r[4],
				(String) r[5],
				(String) r[6],
				(String) r[7],
				r[8] == null ? null : ((Enum<?>) r[8]).name(),
				((Enum<?>) r[9]).name(),
				(String) r[10],
				(String) r[11],
				((Enum<?>) r[12]).name(),
				(Instant) r[13],
				(Instant) r[14],
				(Instant) r[15]
		);
	}
}
