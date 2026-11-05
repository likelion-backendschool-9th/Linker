package com.linker.backend.service.user;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Instant;

import com.linker.backend.repository.account.UserRepository;
import com.linker.backend.repository.moderation.AdminRepository;
import com.linker.backend.repository.moderation.BlockInserter;
import com.linker.backend.repository.moderation.ReportCaseOpener;
import com.linker.backend.repository.moderation.ReportCaseRepository;
import com.linker.backend.repository.moderation.ReportRepository;
import com.linker.backend.repository.moderation.UserBlockRepository;
import com.linker.backend.service.admin.AdminNotificationService;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class BlockServiceTest {

	@Mock
	UserRepository users;

	@Mock
	UserBlockRepository blocks;

	@Mock
	BlockInserter inserter;

	@Mock
	ReportCaseRepository cases;

	@Mock
	ReportCaseOpener caseOpener;

	@Mock
	ReportRepository reports;

	@Mock
	AdminRepository admins;

	@Mock
	AdminNotificationService adminNotifications;

	@Mock
	com.linker.backend.repository.profile.FollowRepository follows;

	UserModerationService service;

	@BeforeEach
	void setUp() {
		service = new UserModerationService(
				users, blocks, inserter, cases, caseOpener, reports, admins, adminNotifications, follows, Clock.systemUTC());
	}

	@Test
	void hidesDirectMessageUsesViewerOwnedCoveringPeriod() {
		Instant at = Instant.parse("2026-11-04T00:00:00Z");
		when(blocks.existsCovering(10L, 20L, at)).thenReturn(true);

		assertThat(service.hidesDirectMessage(10L, 20L, at)).isTrue();
		verify(blocks).existsCovering(10L, 20L, at);
	}

	@Test
	void hidesDirectMessageIgnoresSelfAndNullInstant() {
		assertThat(service.hidesDirectMessage(10L, 10L, Instant.now())).isFalse();
		assertThat(service.hidesDirectMessage(10L, 20L, null)).isFalse();
		verifyNoInteractions(blocks);
	}

	@Test
	void blockedEitherWayOnlyLooksAtActivePeriods() {
		when(blocks.existsByBlockerIdAndBlockedIdAndUnblockedAtIsNull(1L, 2L)).thenReturn(false);
		when(blocks.existsByBlockerIdAndBlockedIdAndUnblockedAtIsNull(2L, 1L)).thenReturn(true);

		assertThat(service.blockedEitherWay(1L, 2L)).isTrue();
	}
}
