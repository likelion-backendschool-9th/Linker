package com.linker.backend.repository.notification;

import java.time.Instant;

import com.linker.backend.entity.notification.Notification;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface NotificationRepository extends JpaRepository<Notification, Long> {

	@Query("""
			select count(notification) from Notification notification
			where notification.user.id = :userId
			  and notification.readAt is null
			  and (notification.deliverAfter is null or notification.deliverAfter <= :now)
			""")
	long countVisibleUnread(Long userId, Instant now);
}
