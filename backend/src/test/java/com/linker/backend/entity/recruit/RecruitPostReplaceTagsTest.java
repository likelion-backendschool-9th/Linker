package com.linker.backend.entity.recruit;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

import com.linker.backend.entity.account.User;
import com.linker.backend.entity.account.UserType;
import com.linker.backend.entity.profile.TechTag;

import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

class RecruitPostReplaceTagsTest {

	@Test
	void replaceTagsKeepsOverlappingTagsWithoutClearingAll() {
		User author = User.create("dev", UserType.DEVELOPER);
		ReflectionTestUtils.setField(author, "id", 1L);
		RecruitPost post = RecruitPost.open(
				author, "title", "desc", WorkMode.ONLINE, null, null, null,
				LocalDate.of(2026, 11, 20), Instant.parse("2026-11-05T01:00:00Z"));

		TechTag typescript = tag(1L, "TypeScript");
		TechTag java = tag(8L, "Java");
		post.addTag(RecruitPostTag.of(typescript));

		post.replaceTags(List.of(RecruitPostTag.of(typescript), RecruitPostTag.of(java)));

		assertThat(post.getTags()).hasSize(2);
		assertThat(post.getTags().stream().map(item -> item.getTag().getId()))
				.containsExactlyInAnyOrder(1L, 8L);
	}

	private static TechTag tag(long id, String name) {
		TechTag tag = new TechTag() {
		};
		ReflectionTestUtils.setField(tag, "id", id);
		ReflectionTestUtils.setField(tag, "name", name);
		return tag;
	}
}
