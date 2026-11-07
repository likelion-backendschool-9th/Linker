package com.linker.backend.entity.team;

import java.time.Instant;

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
import com.linker.backend.entity.team.type.BoardStatus;
import com.linker.backend.entity.team.type.BoardStatusColor;

/** Maps the existing ERD table promoted by V20; internal and GitHub identifiers remain distinct. */
@Entity
@Table(name = "board_status_mappings")
public class BoardStatusMapping {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Column(nullable = false)
	private Long boardId;

	@Column(nullable = false)
	private String githubOptionId;

	@Column(nullable = false)
	private String githubOptionName;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 32)
	private BoardStatus linkerStatus;

	/** GitHub Status option color enum; captured at board link (V25). */
	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 16)
	private BoardStatusColor color;

	@CreationTimestamp
	@Column(nullable = false, updatable = false)
	private Instant createdAt;

	@UpdateTimestamp
	@Column(nullable = false)
	private Instant updatedAt;

	protected BoardStatusMapping() {
	}

	public static BoardStatusMapping map(
			long boardId,
			String optionId,
			String optionName,
			BoardStatus status,
			BoardStatusColor color) {
		BoardStatusMapping mapping = new BoardStatusMapping();
		mapping.boardId = boardId;
		mapping.githubOptionId = optionId;
		mapping.githubOptionName = optionName;
		mapping.linkerStatus = status;
		mapping.color = color == null ? BoardStatusColor.GRAY : color;
		return mapping;
	}

	public Long getId() {
		return id;
	}

	public Long getBoardId() {
		return boardId;
	}

	public String getGithubOptionId() {
		return githubOptionId;
	}

	public String getGithubOptionName() {
		return githubOptionName;
	}

	public BoardStatus getLinkerStatus() {
		return linkerStatus;
	}

	public BoardStatusColor getColor() {
		return color;
	}

	public Instant getCreatedAt() {
		return createdAt;
	}

	public Instant getUpdatedAt() {
		return updatedAt;
	}

}
