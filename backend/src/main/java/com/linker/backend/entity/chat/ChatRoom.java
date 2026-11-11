package com.linker.backend.entity.chat;

import java.time.Instant;

import com.linker.backend.entity.chat.type.DmStatus;
import com.linker.backend.entity.chat.type.RequestKind;
import com.linker.backend.entity.chat.type.RoomType;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

@Entity
@Table(name = "chat_rooms")
public class ChatRoom {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 16)
	private RoomType roomType;

	private Long teamId;

	@Column(length = 64)
	private String dmKey;

	@Enumerated(EnumType.STRING)
	@Column(length = 16)
	private DmStatus dmStatus;

	@Enumerated(EnumType.STRING)
	@Column(length = 16)
	private RequestKind requestKind;

	private Long requesterId;

	private Instant requestExpiresAt;

	private Instant respondedAt;

	private Long lastMessageId;

	private Instant lastMessageAt;

	@CreationTimestamp
	@Column(nullable = false, updatable = false)
	private Instant createdAt;

	@UpdateTimestamp
	@Column(nullable = false)
	private Instant updatedAt;

	protected ChatRoom() {
	}

	public static ChatRoom direct(
			long requesterId,
			long otherUserId,
			DmStatus status,
			RequestKind kind,
			Instant requestExpiresAt
	) {
		ChatRoom room = new ChatRoom();
		room.roomType = RoomType.DIRECT;
		long low = Math.min(requesterId, otherUserId);
		long high = Math.max(requesterId, otherUserId);
		room.dmKey = low + ":" + high;
		room.dmStatus = status;
		room.requestKind = kind;
		room.requesterId = requesterId;
		room.requestExpiresAt = requestExpiresAt;
		return room;
	}

	public static ChatRoom team(Long teamId) {
		ChatRoom room = new ChatRoom();
		room.roomType = RoomType.TEAM;
		room.teamId = teamId;
		return room;
	}

	public void markAccepted(Instant when) {
		this.dmStatus = DmStatus.ACCEPTED;
		this.respondedAt = when;
	}

	/** Opens this pair so a recruiter can enter and talk with the developer. */
	public void openRecruiting(long recruiterId, Instant when) {
		this.dmStatus = DmStatus.ACCEPTED;
		this.requestKind = RequestKind.RECRUITING;
		this.requesterId = recruiterId;
		this.requestExpiresAt = null;
		this.respondedAt = when;
	}

	public void markRejected(Instant when) {
		this.dmStatus = DmStatus.REJECTED;
		this.respondedAt = when;
	}

	/** Same pair row (one per {@code dm_key}) starts a fresh general request from {@code requesterId}. */
	public void reopenRequest(long requesterId, Instant expiresAt) {
		this.dmStatus = DmStatus.REQUESTED;
		this.requestKind = RequestKind.GENERAL;
		this.requesterId = requesterId;
		this.requestExpiresAt = expiresAt;
		this.respondedAt = null;
	}

	public String getDmKey() {
		return dmKey;
	}

	public boolean admitsSubscriber(Instant now) {
		if (roomType == RoomType.TEAM) {
			return true;
		}
		return dmStatus == DmStatus.ACCEPTED
				|| (dmStatus == DmStatus.REQUESTED
						&& requestExpiresAt != null
						&& requestExpiresAt.isAfter(now));
	}

	public boolean admitsSender() {
		if (roomType == RoomType.TEAM) {
			return true;
		}
		return dmStatus == DmStatus.ACCEPTED;
	}

	public Long getId() {
		return id;
	}

	public RoomType getRoomType() {
		return roomType;
	}

	public Long getTeamId() {
		return teamId;
	}

	public DmStatus getDmStatus() {
		return dmStatus;
	}

	public Long getRequesterId() {
		return requesterId;
	}

	public Instant getRequestExpiresAt() {
		return requestExpiresAt;
	}

	public Instant getRespondedAt() {
		return respondedAt;
	}

	public Long getLastMessageId() {
		return lastMessageId;
	}

	public void markLastMessage(long messageId, Instant at) {
		this.lastMessageId = messageId;
		this.lastMessageAt = at;
	}

	public Instant getCreatedAt() {
		return createdAt;
	}

	public Instant getUpdatedAt() {
		return updatedAt;
	}
}
