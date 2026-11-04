package com.linker.backend.entity.notification;

import java.time.Instant;

import com.linker.backend.entity.account.User;
import com.linker.backend.global.jpa.BaseTimeEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * In-app notification row. Role-specific notification services create these rows;
 * push delivery is handled asynchronously by a later worker.
 */
@Entity
@Table(name = "notifications")
public class Notification extends BaseTimeEntity {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "user_id", nullable = false)
	private User user;

	@Column(nullable = false, length = 64)
	private String notificationType;

	@ManyToOne(fetch = FetchType.LAZY)
	@JoinColumn(name = "actor_id")
	private User actor;

	@Column(length = 64)
	private String targetType;

	private Long targetId;

	@Column(length = 512)
	private String linkPath;

	@JdbcTypeCode(SqlTypes.JSON)
	@Column(columnDefinition = "jsonb")
	private String payload;

	@Column(length = 128)
	private String groupKey;

	private Instant deliverAfter;

	private Instant pushedAt;

	private Instant readAt;

	protected Notification() {
	}

	public static Notification create(
			User recipient,
			String notificationType,
			User actor,
			String targetType,
			Long targetId,
			String linkPath,
			String payloadJson,
			String groupKey,
			Instant deliverAfter
	) {
		Notification notification = new Notification();
		notification.user = recipient;
		notification.notificationType = notificationType;
		notification.actor = actor;
		notification.targetType = targetType;
		notification.targetId = targetId;
		notification.linkPath = linkPath;
		notification.payload = payloadJson;
		notification.groupKey = groupKey;
		notification.deliverAfter = deliverAfter;
		return notification;
	}

	public Long getId() {
		return id;
	}

	public User getUser() {
		return user;
	}

	public String getNotificationType() {
		return notificationType;
	}

	public User getActor() {
		return actor;
	}

	public String getTargetType() {
		return targetType;
	}

	public Long getTargetId() {
		return targetId;
	}

	public String getLinkPath() {
		return linkPath;
	}

	public String getPayload() {
		return payload;
	}

	public String getGroupKey() {
		return groupKey;
	}

	public Instant getDeliverAfter() {
		return deliverAfter;
	}

	public Instant getPushedAt() {
		return pushedAt;
	}

	public Instant getReadAt() {
		return readAt;
	}
}
