package com.linker.backend.entity.post;

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
@Table(name = "post_images")
public class PostImage extends BaseTimeEntity {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "post_id", nullable = false)
	private Post post;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "file_id", nullable = false)
	private UploadedFile file;

	@Column(nullable = false)
	private int sortOrder;

	protected PostImage() {
	}

	public static PostImage of(UploadedFile file, int sortOrder) {
		PostImage image = new PostImage();
		image.file = file;
		image.sortOrder = sortOrder;
		return image;
	}

	void attach(Post post) {
		this.post = post;
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
