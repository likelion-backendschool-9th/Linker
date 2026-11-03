package com.linker.backend.repository.notification;

import com.linker.backend.entity.notification.Notification;

import org.springframework.data.jpa.repository.JpaRepository;

public interface NotificationRepository extends JpaRepository<Notification, Long> {
}
