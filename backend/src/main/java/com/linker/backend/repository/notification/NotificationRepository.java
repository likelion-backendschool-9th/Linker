package com.linker.backend.repository.notification;

import java.time.Instant;
import java.util.List;

import com.linker.backend.entity.notification.Notification;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

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
			order by notification.createdAt desc, notification.id desc
			""")
	List<Notification> findFirstVisiblePage(
			@Param("userId") long userId,
			@Param("now") Instant now,
			Pageable pageable
	);

	@Query("""
			select notification from Notification notification
			where notification.user.id = :userId
			  and (notification.deliverAfter is null or notification.deliverAfter <= :now)
			  and (
			    notification.createdAt < :createdAt
			    or (notification.createdAt = :createdAt and notification.id < :id)
			  )
			order by notification.createdAt desc, notification.id desc
			""")
	List<Notification> findVisiblePageAfter(
			@Param("userId") long userId,
			@Param("now") Instant now,
			@Param("createdAt") Instant createdAt,
			@Param("id") long id,
			Pageable pageable
	);

	@Query("""
			select notification from Notification notification
			where notification.pushedAt is null
			  and notification.user.pushEnabled = true
			  and notification.notificationType <> 'CHAT'
			  and notification.deliverAfter is not null
			  and notification.deliverAfter <= :now
			order by notification.user.id, notification.createdAt, notification.id
			""")
	List<Notification> findDueDeferred(@Param("now") Instant now, Pageable pageable);

	@Query("""
			select notification from Notification notification
			where notification.pushedAt is null
			  and notification.user.pushEnabled = true
			  and notification.notificationType = 'CHAT'
			  and notification.deliverAfter is null
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
}
