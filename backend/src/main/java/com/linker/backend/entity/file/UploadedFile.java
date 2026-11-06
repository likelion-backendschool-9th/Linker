package com.linker.backend.entity.file;

import java.time.Instant;

import com.linker.backend.entity.file.type.UploadPurpose;

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
@Table(name = "uploaded_files")
public class UploadedFile {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Column(nullable = false)
	private Long uploaderId;

	@Enumerated(EnumType.STRING)
	@Column(length = 16)
	private UploadPurpose purpose;

	@Column(nullable = false, unique = true, length = 512)
	private String storageKey;

	@Column(length = 2048)
	private String url;

	@Column(nullable = false, length = 127)
	private String contentType;

	@Column(nullable = false)
	private long byteSize;

	private Integer width;

	private Integer height;

	private Instant originalDeletedAt;

	@CreationTimestamp
	@Column(nullable = false, updatable = false)
	private Instant createdAt;

	@UpdateTimestamp
	@Column(nullable = false)
	private Instant updatedAt;

	protected UploadedFile() {
	}

	public static UploadedFile pending(long uploaderId, UploadPurpose purpose, String storageKey, String contentType, long byteSize) {
		UploadedFile file = new UploadedFile();
		file.uploaderId = uploaderId;
		file.purpose = purpose;
		file.storageKey = storageKey;
		file.contentType = contentType;
		file.byteSize = byteSize;
		return file;
	}

	public void complete(String url, String contentType, long byteSize, int width, int height) {
		this.url = url;
		this.contentType = contentType;
		this.byteSize = byteSize;
		this.width = width;
		this.height = height;
	}

	public Long getId() {
		return id;
	}

	public Long getUploaderId() {
		return uploaderId;
	}

	public UploadPurpose getPurpose() {
		return purpose;
	}

	public String getStorageKey() {
		return storageKey;
	}

	public String getUrl() {
		return url;
	}

	public String getContentType() {
		return contentType;
	}

	public long getByteSize() {
		return byteSize;
	}

	public boolean isComplete() {
		return url != null;
	}

	public Instant getCreatedAt() {
		return createdAt;
	}

	public Instant getUpdatedAt() {
		return updatedAt;
	}
}
