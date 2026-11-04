package com.linker.backend.dto.issue;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

import org.junit.jupiter.api.Test;

class IssueCacheSnapshotTest {

	@Test
	void copiesRelationsSoCallersCannotChangePendingRefreshData() {
		var labels = new ArrayList<>(List.of(new IssueCacheSnapshot.Label("bug", "ff0000")));
		var value = snapshot(1, List.of(), labels);
		labels.clear();
		assertThat(value.labels()).hasSize(1);
		assertThatThrownBy(() -> value.labels().clear()).isInstanceOf(UnsupportedOperationException.class);
	}

	@Test
	void rejectsDuplicateAssigneesAndLabelsBeforeWriting() {
		var user = new IssueCacheSnapshot.Assignee(10, "octocat", null);
		var label = new IssueCacheSnapshot.Label("bug", "ff0000");
		assertThatThrownBy(() -> snapshot(1, List.of(user, user), List.of())).isInstanceOf(IllegalArgumentException.class);
		assertThatThrownBy(() -> snapshot(1, List.of(), List.of(label, label))).isInstanceOf(IllegalArgumentException.class);
	}

	@Test
	void rejectsInvalidIdentityWithoutInventingAnIssueNumber() {
		assertThatThrownBy(() -> snapshot(0, List.of(), List.of())).isInstanceOf(IllegalArgumentException.class);
		assertThatThrownBy(() -> new IssueCacheSnapshot.Assignee(0, "octocat", null)).isInstanceOf(IllegalArgumentException.class);
	}

	private static IssueCacheSnapshot snapshot(long teamId, List<IssueCacheSnapshot.Assignee> users,
			List<IssueCacheSnapshot.Label> labels) {
		return new IssueCacheSnapshot(teamId, 10, 100, "I_100", 7, "Issue", IssueCacheSnapshot.State.OPEN,
				null, "octocat", "https://github.com/example/repo/issues/7", Instant.parse("2026-11-04T00:00:00Z"), null,
				users, labels);
	}
}
