package com.linker.backend.entity.post;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

import com.linker.backend.entity.account.User;
import com.linker.backend.entity.github.GithubRepo;
import com.linker.backend.global.jpa.BaseTimeEntity;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;

@Entity
@Table(name = "posts")
public class Post extends BaseTimeEntity {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "author_id", nullable = false)
	private User author;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "repo_id", nullable = false)
	private GithubRepo repo;

	private Long teamId;

	@Column(nullable = false, length = 60)
	private String summary;

	@Column(nullable = false, length = 2000)
	private String body;

	@Column(length = 40)
	private String myRole;

	private LocalDate periodStart;

	private LocalDate periodEnd;

	private Integer teamSize;

	@Column(nullable = false)
	private int myCommitCount;

	@Column(nullable = false)
	private int linkerIssueCount;

	@Column(nullable = false)
	private int likeCount;

	@Column(nullable = false)
	private int commentCount;

	@Column(nullable = false)
	private int viewCount;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 16)
	private PostVisibility visibility;

	private Instant editedAt;

	private Instant deletedAt;

	@OneToMany(mappedBy = "post", cascade = CascadeType.ALL, orphanRemoval = true)
	@OrderBy("sortOrder ASC")
	private List<PostImage> images = new ArrayList<>();

	@OneToMany(mappedBy = "post", cascade = CascadeType.ALL, orphanRemoval = true)
	@OrderBy("sortOrder ASC")
	private List<PostDemoLink> demoLinks = new ArrayList<>();

	@OneToMany(mappedBy = "post", cascade = CascadeType.ALL, orphanRemoval = true)
	private List<PostTag> tags = new ArrayList<>();

	protected Post() {
	}

	public static Post publish(
			User author,
			GithubRepo repo,
			Long teamId,
			String summary,
			String body,
			String myRole,
			LocalDate periodStart,
			LocalDate periodEnd,
			Integer teamSize,
			int myCommitCount,
			int linkerIssueCount
	) {
		Post post = new Post();
		post.author = author;
		post.repo = repo;
		post.teamId = teamId;
		post.summary = summary;
		post.body = body;
		post.myRole = myRole;
		post.periodStart = periodStart;
		post.periodEnd = periodEnd;
		post.teamSize = teamSize;
		post.myCommitCount = myCommitCount;
		post.linkerIssueCount = linkerIssueCount;
		post.likeCount = 0;
		post.commentCount = 0;
		post.viewCount = 0;
		post.visibility = PostVisibility.VISIBLE;
		return post;
	}

	public void updateContent(
			String summary,
			String body,
			String myRole,
			LocalDate periodStart,
			LocalDate periodEnd,
			Integer teamSize,
			Instant editedAt
	) {
		this.summary = summary;
		this.body = body;
		this.myRole = myRole;
		this.periodStart = periodStart;
		this.periodEnd = periodEnd;
		this.teamSize = teamSize;
		this.editedAt = editedAt;
	}

	public void replaceImages(List<PostImage> next) {
		images.clear();
		for (PostImage image : next) {
			addImage(image);
		}
	}

	public void replaceDemoLinks(List<PostDemoLink> next) {
		demoLinks.clear();
		for (PostDemoLink link : next) {
			addDemoLink(link);
		}
	}

	public void replaceTags(List<PostTag> next) {
		tags.clear();
		for (PostTag tag : next) {
			addTag(tag);
		}
	}

	public void addImage(PostImage image) {
		images.add(image);
		image.attach(this);
	}

	public void addDemoLink(PostDemoLink link) {
		demoLinks.add(link);
		link.attach(this);
	}

	public void addTag(PostTag tag) {
		tags.add(tag);
		tag.attach(this);
	}

	public Long getId() {
		return id;
	}

	public User getAuthor() {
		return author;
	}

	public GithubRepo getRepo() {
		return repo;
	}

	public Long getTeamId() {
		return teamId;
	}

	public String getSummary() {
		return summary;
	}

	public String getBody() {
		return body;
	}

	public String getMyRole() {
		return myRole;
	}

	public LocalDate getPeriodStart() {
		return periodStart;
	}

	public LocalDate getPeriodEnd() {
		return periodEnd;
	}

	public Integer getTeamSize() {
		return teamSize;
	}

	public int getMyCommitCount() {
		return myCommitCount;
	}

	public int getLinkerIssueCount() {
		return linkerIssueCount;
	}

	public Instant getEditedAt() {
		return editedAt;
	}

	public Instant getDeletedAt() {
		return deletedAt;
	}

	public List<PostImage> getImages() {
		return images;
	}

	public List<PostDemoLink> getDemoLinks() {
		return demoLinks;
	}

	public List<PostTag> getTags() {
		return tags;
	}
}
