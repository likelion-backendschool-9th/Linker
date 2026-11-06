package com.linker.backend.repository.notification;

import java.util.Optional;
import java.util.Collection;
import java.util.List;

import com.linker.backend.entity.notification.PushToken;

import org.springframework.data.jpa.repository.JpaRepository;

public interface PushTokenRepository extends JpaRepository<PushToken, Long> {

	Optional<PushToken> findByExpoPushToken(String expoPushToken);

	List<PushToken> findByUser_IdIn(Collection<Long> userIds);
}
