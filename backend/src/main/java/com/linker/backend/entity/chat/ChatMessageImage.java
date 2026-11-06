package com.linker.backend.entity.chat;

import com.linker.backend.entity.file.UploadedFile;
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

@Entity
@Table(name = "chat_message_images")
public class ChatMessageImage extends BaseTimeEntity {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "message_id", nullable = false)
	private ChatMessage message;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "file_id", nullable = false)
	private UploadedFile file;

	@Column(nullable = false)
	private int sortOrder;

	protected ChatMessageImage() {
	}

	public static ChatMessageImage link(ChatMessage message, UploadedFile file, int sortOrder) {
		ChatMessageImage image = new ChatMessageImage();
		image.message = message;
		image.file = file;
		image.sortOrder = sortOrder;
		return image;
	}

	public Long getId() {
		return id;
	}

	public UploadedFile getFile() {
		return file;
	}

	public int getSortOrder() {
		return sortOrder;
	}
}
