package com.linker.backend.repository.notification;

import java.time.Instant;
import java.util.Collection;
import java.util.List;

import com.linker.backend.entity.notification.Notification;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

public interface NotificationRepository extends JpaRepository<Notification, Long> {

	@Query("""
			select count(notification) from Notification notification
			where notification.user.id = :userId
			  and notification.readAt is null
			  and (notification.deliverAfter is null or notification.deliverAfter <= :now)
			""")
	long countVisibleUnread(Long userId, Instant now);

	@Query("""
			select notification from Notification notification
			where notification.user.id = :userId
			  and (notification.deliverAfter is null or notification.deliverAfter <= :now)
			  and (:unreadOnly = false or notification.readAt is null)
			order by notification.createdAt desc, notification.id desc
			""")
	List<Notification> findFirstVisiblePage(
			@Param("userId") long userId,
			@Param("now") Instant now,
			@Param("unreadOnly") boolean unreadOnly,
			Pageable pageable
	);

	@Query("""
			select notification from Notification notification
			where notification.user.id = :userId
			  and (notification.deliverAfter is null or notification.deliverAfter <= :now)
			  and (:unreadOnly = false or notification.readAt is null)
			  and (
			    notification.createdAt < :createdAt
			    or (notification.createdAt = :createdAt and notification.id < :id)
			  )
			order by notification.createdAt desc, notification.id desc
			""")
	List<Notification> findVisiblePageAfter(
			@Param("userId") long userId,
			@Param("now") Instant now,
			@Param("unreadOnly") boolean unreadOnly,
			@Param("createdAt") Instant createdAt,
			@Param("id") long id,
			Pageable pageable
	);

	@Query("""
			select notification from Notification notification
			where notification.pushedAt is null
			  and notification.user.pushEnabled = true
			  and exists (select 1 from PushToken token where token.user.id = notification.user.id)
			  and notification.notificationType not in ('CHAT', 'CHAT_MENTION')
			  and (notification.deliverAfter is null or notification.deliverAfter <= :now)
			order by notification.user.id, notification.createdAt, notification.id
			""")
	List<Notification> findDueNonChat(@Param("now") Instant now, Pageable pageable);

	// Membership is checked again at push time: someone who left the room after the row was made gets no
	// push. The in-app row stays, and its /chats link answers 404 like any room they cannot open.
	@Query("""
			select notification from Notification notification
			where notification.pushedAt is null
			  and notification.user.pushEnabled = true
			  and exists (select 1 from PushToken token where token.user.id = notification.user.id)
			  and notification.notificationType in ('CHAT', 'CHAT_MENTION')
			  and notification.deliverAfter is null
			  and exists (
				select member from ChatRoomMember member
				where member.room.id = notification.targetId
				  and member.userId = notification.user.id
				  and member.leftAt is null
			)
			  and (notification.notificationType = 'CHAT_MENTION' or not exists (
				select member from ChatRoomMember member
				where member.room.id = notification.targetId
				  and member.userId = notification.user.id
				  and member.leftAt is null
				  and member.muted = true
			))
			order by notification.user.id, notification.createdAt, notification.id
			""")
	List<Notification> findDueChat(Pageable pageable);

	@Modifying(clearAutomatically = true, flushAutomatically = true)
	@Query("""
			update Notification notification
			set notification.readAt = :now
			where notification.user.id = :userId
			  and notification.readAt is null
			  and (notification.deliverAfter is null or notification.deliverAfter <= :now)
			""")
	int markVisibleUnread(@Param("userId") long userId, @Param("now") Instant now);

	/** Records a push as sent. A direct UPDATE, so it does not depend on the caller's persistence context. */
	@Transactional
	@Modifying(clearAutomatically = true, flushAutomatically = true)
	@Query("""
			update Notification notification
			set notification.pushedAt = :now
			where notification.id in :ids
			  and notification.pushedAt is null
			""")
	int markPushed(@Param("ids") Collection<Long> ids, @Param("now") Instant now);

	/**
	 * Removes the caller's unread rows of one group, so the next row stands for the whole chat room.
	 * No automatic clear: it runs inside the chat send transaction, whose entities must stay managed.
	 */
	@Modifying(flushAutomatically = true)
	@Query("""
			delete from Notification notification
			where notification.user.id = :userId
			  and notification.notificationType = :type
			  and notification.groupKey = :groupKey
			  and notification.readAt is null
			""")
	int deleteUnreadInGroup(@Param("userId") long userId, @Param("type") String type, @Param("groupKey") String groupKey);

	boolean existsByUser_IdAndGroupKey(long userId, String groupKey);
}
