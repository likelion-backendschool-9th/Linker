package com.linker.backend.repository.chat;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.Arrays;
import java.util.List;

import com.linker.backend.entity.chat.type.MessageType;
import com.linker.backend.entity.chat.type.RequestKind;

import jakarta.persistence.EntityManager;
import jakarta.persistence.Query;
import jakarta.persistence.Tuple;

/**
 * Spring Data attaches this class to {@link ChatRoomRepository} by name, so it carries no
 * {@code @Repository}.
 *
 * <p>The list page, list summary and offer list are native queries on purpose: they need
 * {@code LEFT JOIN LATERAL} (latest visible message, unread count, counterpart user, first offer
 * message) and {@code FILTER}/{@code string_agg}, none of which JPQL expresses. They keep the exact
 * SQL they had before the move so results, ordering and cursors do not change.
 * {@link #containedInTab} reuses the same room predicate as the page and summary so the three can
 * never disagree about which rooms belong to a tab.
 */
class ChatRoomRepositoryImpl implements ChatRoomRepositoryCustom {

	private static final String VISIBLE = """
			(
			  r.room_type = 'TEAM'
			  OR m.sender_id IS NULL
			  OR NOT EXISTS (
			    SELECT 1 FROM user_blocks b
			    WHERE b.blocker_id = :viewer
			      AND b.blocked_id = m.sender_id
			      AND b.created_at <= m.created_at
			      AND (b.unblocked_at IS NULL OR b.unblocked_at > m.created_at)
			  )
			)
			""";

	private static final String FROM_MEMBER = """
			FROM chat_rooms r
			JOIN chat_room_members me
			  ON me.room_id = r.id
			 AND me.user_id = :viewer
			 AND me.left_at IS NULL
			 AND me.hidden_at IS NULL
			""";

	/** Rooms with a blocked counterpart drop out of every tab. */
	private static final String NO_BLOCKED_COUNTERPART = """
			(
			  r.room_type = 'TEAM'
			  OR NOT EXISTS (
			    SELECT 1
			    FROM chat_room_members other_member
			    JOIN user_blocks b ON b.unblocked_at IS NULL
			      AND (
			        (b.blocker_id = :viewer AND b.blocked_id = other_member.user_id)
			        OR (b.blocker_id = other_member.user_id AND b.blocked_id = :viewer)
			      )
			    WHERE other_member.room_id = r.id
			      AND other_member.user_id <> :viewer
			  )
			)
			""";

	private static final String ROOM_FILTER = NO_BLOCKED_COUNTERPART + """
			AND (
			  (:tab = 'TEAM' AND r.room_type = 'TEAM')
			  OR (:tab = 'DIRECT' AND r.room_type = 'DIRECT' AND r.dm_status = 'ACCEPTED')
			  OR (
			    :tab = 'REQUEST'
			    AND r.room_type = 'DIRECT'
			    AND r.dm_status = 'REQUESTED'
			    AND r.requester_id <> :viewer
			    AND r.request_expires_at > :now
			  )
			)
			""";

	private static final String CURSOR_FILTER = """
			AND (
			  COALESCE(preview.created_at, r.created_at) < :cursor_sort
			  OR (
			    COALESCE(preview.created_at, r.created_at) = :cursor_sort
			    AND r.id < :cursor_room_id
			  )
			)
			""";

	private static final String PAGE_SQL = """
			SELECT
			  r.id AS room_id,
			  r.room_type,
			  r.request_kind,
			  me.muted,
			  COALESCE(preview.created_at, r.created_at) AS sort_at,
			  preview.id AS preview_id,
			  preview.body AS preview_body,
			  preview.visibility AS preview_visibility,
			  preview.deleted_at AS preview_deleted_at,
			  preview.created_at AS preview_created_at,
			  COALESCE(unread.unread_count, 0) AS unread_count,
			  counterpart.avatar_url,
			  counterpart.display_name,
			  counterpart.username,
			  counterpart.status AS counterpart_status
			%s
			LEFT JOIN LATERAL (
			  SELECT m.id, m.body, m.visibility, m.deleted_at, m.created_at
			  FROM chat_messages m
			  WHERE m.room_id = r.id
			    AND %s
			  ORDER BY m.id DESC
			  LIMIT 1
			) preview ON true
			LEFT JOIN LATERAL (
			  SELECT COUNT(*) AS unread_count
			  FROM chat_messages m
			  WHERE m.room_id = r.id
			    AND (me.last_read_message_id IS NULL OR m.id > me.last_read_message_id)
			    AND (m.sender_id IS NULL OR m.sender_id <> :viewer)
			    AND %s
			) unread ON true
			LEFT JOIN LATERAL (
			  SELECT u.avatar_url, u.display_name, u.username, u.status
			  FROM chat_room_members other_member
			  JOIN users u ON u.id = other_member.user_id
			  WHERE other_member.room_id = r.id
			    AND other_member.user_id <> :viewer
			    AND r.room_type = 'DIRECT'
			  ORDER BY other_member.user_id
			  LIMIT 1
			) counterpart ON true
			WHERE %s
			""".formatted(FROM_MEMBER, VISIBLE, VISIBLE, ROOM_FILTER);

	private static final String PAGE_ORDER = """
			ORDER BY COALESCE(preview.created_at, r.created_at) DESC, r.id DESC
			LIMIT :limit
			""";

	private static final String SUMMARY_SQL = """
			SELECT
			  COALESCE(SUM(unread.unread_count) FILTER (WHERE r.room_type = 'TEAM'), 0) AS team_unread,
			  COALESCE(SUM(unread.unread_count) FILTER (WHERE r.room_type = 'DIRECT' AND r.dm_status = 'ACCEPTED'), 0) AS direct_unread,
			  COALESCE(SUM(unread.unread_count) FILTER (
			    WHERE r.room_type = 'DIRECT' AND r.dm_status = 'REQUESTED'
			      AND r.requester_id <> :viewer AND r.request_expires_at > :now
			  ), 0) AS request_unread,
			  COUNT(*) FILTER (
			    WHERE r.room_type = 'DIRECT' AND r.dm_status = 'REQUESTED'
			      AND r.requester_id <> :viewer AND r.request_expires_at > :now
			  ) AS request_count
			%s
			LEFT JOIN LATERAL (
			  SELECT COUNT(*) AS unread_count
			  FROM chat_messages m
			  WHERE m.room_id = r.id
			    AND (me.last_read_message_id IS NULL OR m.id > me.last_read_message_id)
			    AND (m.sender_id IS NULL OR m.sender_id <> :viewer)
			    AND %s
			) unread ON true
			WHERE %s
			""".formatted(FROM_MEMBER, VISIBLE, NO_BLOCKED_COUNTERPART);

	private static final String IN_TAB_SQL = """
			SELECT COUNT(*) AS in_tab
			%s
			WHERE %s
			AND r.id = :room_id
			""".formatted(FROM_MEMBER, ROOM_FILTER);

	private static final String OFFERS_SQL = """
			select room.id, room.dm_status, room.created_at, room.request_expires_at, room.responded_at,
			       developer.id as developer_id, developer.username, developer.display_name, developer.avatar_url,
			       developer.status as developer_status, developer.deleted_at, developer.job_seeking_status,
			       first_message.body as first_body, first_message.created_at as first_at,
			       (select string_agg(tag.name, ',' order by tag.sort_order, tag.id)
			        from user_tech_tags selected
			        join tech_tags tag on tag.id = selected.tag_id
			        where selected.user_id = developer.id) as tech_stack
			from chat_rooms room
			left join chat_room_members other
			  on other.room_id = room.id and other.user_id <> room.requester_id and other.left_at is null
			left join users developer on developer.id = other.user_id
			left join lateral (
			  select body, created_at
			  from chat_messages message
			  where message.room_id = room.id
			    and message.sender_id = room.requester_id
			    and message.message_type = 'TEXT'
			  order by message.id
			  limit 1
			) first_message on true
			where room.requester_id = :recruiter
			  and room.room_type = 'DIRECT'
			  and room.request_kind = 'RECRUITING'
			order by room.created_at desc, room.id desc
			""";

	private final EntityManager em;

	ChatRoomRepositoryImpl(EntityManager em) {
		this.em = em;
	}

	@Override
	public List<ChatListRow> listPage(
			long viewerId, String tab, Instant now, Instant cursorSort, Long cursorRoomId, int limit
	) {
		boolean cursor = cursorSort != null;
		Query query = em.createNativeQuery(PAGE_SQL + (cursor ? CURSOR_FILTER : "") + PAGE_ORDER, Tuple.class)
				.setParameter("viewer", viewerId)
				.setParameter("tab", tab)
				.setParameter("now", now)
				.setParameter("limit", limit);
		if (cursor) {
			query.setParameter("cursor_sort", cursorSort).setParameter("cursor_room_id", cursorRoomId == null ? 0L : cursorRoomId);
		}
		return tuples(query).stream().map(ChatRoomRepositoryImpl::listRow).toList();
	}

	@Override
	public ChatListSummary listSummary(long viewerId, Instant now) {
		Query query = em.createNativeQuery(SUMMARY_SQL, Tuple.class)
				.setParameter("viewer", viewerId)
				.setParameter("now", now);
		Tuple row = tuples(query).get(0);
		return new ChatListSummary(
				number(row, "team_unread"),
				number(row, "direct_unread"),
				number(row, "request_unread"),
				number(row, "request_count")
		);
	}

	@Override
	public boolean containedInTab(long viewerId, String tab, long roomId, Instant now) {
		Query query = em.createNativeQuery(IN_TAB_SQL, Tuple.class)
				.setParameter("viewer", viewerId)
				.setParameter("tab", tab)
				.setParameter("now", now)
				.setParameter("room_id", roomId);
		return number(tuples(query).get(0), "in_tab") > 0;
	}

	@Override
	public List<OfferRow> recruitingOffers(long recruiterId) {
		Query query = em.createNativeQuery(OFFERS_SQL, Tuple.class).setParameter("recruiter", recruiterId);
		return tuples(query).stream().map(row -> new OfferRow(
				number(row, "id"),
				(String) row.get("dm_status"),
				instant(row.get("created_at")),
				instant(row.get("request_expires_at")),
				instant(row.get("responded_at")),
				row.get("developer_id") == null ? null : number(row, "developer_id"),
				(String) row.get("username"),
				(String) row.get("display_name"),
				(String) row.get("avatar_url"),
				(String) row.get("developer_status"),
				instant(row.get("deleted_at")),
				(String) row.get("job_seeking_status"),
				(String) row.get("first_body"),
				instant(row.get("first_at")),
				tags((String) row.get("tech_stack"))
		)).toList();
	}

	@Override
	public OfferMessage firstOfferMessage(long recruiterId, long roomId) {
		boolean offerRoom = !em.createQuery("""
				select r.id from ChatRoom r
				where r.id = :room and r.requesterId = :recruiter and r.requestKind = :kind
				""", Long.class)
				.setParameter("room", roomId)
				.setParameter("recruiter", recruiterId)
				.setParameter("kind", RequestKind.RECRUITING)
				.getResultList()
				.isEmpty();
		if (!offerRoom) {
			return null;
		}
		List<Object[]> first = em.createQuery("""
				select m.body, m.createdAt from ChatMessage m
				where m.room.id = :room and m.senderId = :recruiter and m.messageType = :type
				order by m.id
				""", Object[].class)
				.setParameter("room", roomId)
				.setParameter("recruiter", recruiterId)
				.setParameter("type", MessageType.TEXT)
				.setMaxResults(1)
				.getResultList();
		return first.isEmpty() ? new OfferMessage(null, null) : new OfferMessage((String) first.get(0)[0], (Instant) first.get(0)[1]);
	}

	private static ChatListRow listRow(Tuple row) {
		boolean hasPreview = row.get("preview_id") != null;
		return new ChatListRow(
				number(row, "room_id"),
				(String) row.get("room_type"),
				(String) row.get("request_kind"),
				(Boolean) row.get("muted"),
				instant(row.get("sort_at")),
				hasPreview ? (String) row.get("preview_body") : null,
				hasPreview ? (String) row.get("preview_visibility") : null,
				hasPreview ? instant(row.get("preview_deleted_at")) : null,
				hasPreview ? instant(row.get("preview_created_at")) : null,
				number(row, "unread_count"),
				(String) row.get("avatar_url"),
				(String) row.get("display_name"),
				(String) row.get("username"),
				(String) row.get("counterpart_status")
		);
	}

	@SuppressWarnings("unchecked")
	private static List<Tuple> tuples(Query query) {
		return query.getResultList();
	}

	private static long number(Tuple row, String alias) {
		return ((Number) row.get(alias)).longValue();
	}

	private static Instant instant(Object value) {
		return switch (value) {
			case null -> null;
			case Instant instant -> instant;
			case Timestamp timestamp -> timestamp.toInstant();
			case OffsetDateTime offset -> offset.toInstant();
			default -> throw new IllegalStateException("Unexpected timestamp type " + value.getClass());
		};
	}

	private static List<String> tags(String stacked) {
		if (stacked == null || stacked.isBlank()) {
			return List.of();
		}
		return Arrays.stream(stacked.split(",")).limit(3).toList();
	}
}
