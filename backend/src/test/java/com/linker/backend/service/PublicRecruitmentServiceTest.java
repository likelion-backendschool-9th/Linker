package com.linker.backend.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

import com.linker.backend.entity.account.User;
import com.linker.backend.entity.account.UserType;
import com.linker.backend.entity.recruit.RecruitPost;
import com.linker.backend.entity.recruit.RecruitRole;
import com.linker.backend.entity.recruit.RecruitRoleType;
import com.linker.backend.entity.recruit.RecruitStatus;
import com.linker.backend.entity.recruit.RecruitVisibility;
import com.linker.backend.entity.recruit.WorkMode;
import com.linker.backend.repository.moderation.UserBlockRepository;
import com.linker.backend.repository.recruit.RecruitPostRepository;
import com.linker.backend.service.recruit.RecruitCardMapper;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Pageable;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class PublicRecruitmentServiceTest {

	@Mock
	RecruitPostRepository posts;
	@Mock
	UserBlockRepository blocks;

	PublicRecruitmentService service;

	@BeforeEach
	void setUp() {
		service = new PublicRecruitmentService(posts, blocks, new RecruitCardMapper());
	}

	@Test
	void listOpenReturnsNewestCards() {
		RecruitPost post = openPost(1L, "Linker 모집");
		when(posts.findOpenNewest(
				eq(RecruitStatus.OPEN),
				eq(RecruitVisibility.VISIBLE),
				eq(null),
				eq(null),
				eq(null),
				eq(true),
				eq(List.of(-1L)),
				any(Pageable.class)
		)).thenReturn(List.of(post));

		var page = service.listOpen(null, null, null, "NEWEST", null);

		assertThat(page.items()).hasSize(1);
		assertThat(page.items().getFirst().title()).isEqualTo("Linker 모집");
		assertThat(page.items().getFirst().roles()).hasSize(1);
		assertThat(page.nextCursor()).isNull();
	}

	private static RecruitPost openPost(long id, String title) {
		User author = User.create("author", UserType.DEVELOPER);
		ReflectionTestUtils.setField(author, "id", 9L);
		RecruitPost post = RecruitPost.open(
				author, title, "소개", WorkMode.ONLINE, null, null, null,
				LocalDate.now().plusDays(10), Instant.parse("2026-11-05T00:00:00Z"));
		ReflectionTestUtils.setField(post, "id", id);
		ReflectionTestUtils.setField(post, "createdAt", Instant.parse("2026-11-05T00:00:00Z"));
		RecruitRole role = RecruitRole.of(RecruitRoleType.BACKEND, 2);
		post.addRole(role);
		ReflectionTestUtils.setField(role, "id", 11L);
		return post;
	}
}
