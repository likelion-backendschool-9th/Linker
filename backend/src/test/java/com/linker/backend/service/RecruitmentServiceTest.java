package com.linker.backend.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import com.linker.backend.entity.account.User;
import com.linker.backend.entity.account.type.UserType;
import com.linker.backend.entity.recruit.type.ApplicationStatus;
import com.linker.backend.entity.recruit.RecruitPost;
import com.linker.backend.entity.recruit.RecruitRole;
import com.linker.backend.entity.recruit.type.RecruitRoleType;
import com.linker.backend.entity.recruit.type.RecruitStatus;
import com.linker.backend.entity.recruit.type.RecruitVisibility;
import com.linker.backend.entity.recruit.type.WorkMode;
import com.linker.backend.global.error.ApiException;
import com.linker.backend.repository.moderation.UserBlockRepository;
import com.linker.backend.repository.recruit.ApplicationRepository;
import com.linker.backend.repository.recruit.RecruitPostRepository;
import com.linker.backend.dto.recruit.mapper.RecruitCardMapper;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Pageable;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class RecruitmentServiceTest {

	@Mock
	RecruitPostRepository posts;
	@Mock
	ApplicationRepository applications;
	@Mock
	UserBlockRepository blocks;

	RecruitmentService service;

	@BeforeEach
	void setUp() {
		service = new RecruitmentService(posts, applications, blocks, new RecruitCardMapper());
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

	@Test
	void detailReturnsIntroAndApplicantCountForGuest() {
		RecruitPost post = openPost(3L, "상세 모집");
		when(posts.findDetailedById(3L)).thenReturn(Optional.of(post));
		when(applications.countByRecruitPostIdAndStatus(3L, ApplicationStatus.PENDING)).thenReturn(2L);

		var detail = service.detail(3L);

		assertThat(detail.intro()).isEqualTo("소개");
		assertThat(detail.isAuthor()).isFalse();
		assertThat(detail.isTeamMember()).isFalse();
		assertThat(detail.myApplication()).isNull();
		assertThat(detail.applicantCount()).isEqualTo(2);
		assertThat(detail.authorCard().id()).isEqualTo(9L);
	}

	@Test
	void detailNotFoundWhenMissing() {
		when(posts.findDetailedById(99L)).thenReturn(Optional.empty());

		assertThatThrownBy(() -> service.detail(99L))
				.isInstanceOf(ApiException.class)
				.satisfies(error -> assertThat(((ApiException) error).getCode()).isEqualTo("NOT_FOUND"));
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
