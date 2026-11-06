package com.linker.backend;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

import com.linker.backend.entity.account.User;
import com.linker.backend.entity.account.type.UserType;
import com.linker.backend.entity.chat.ChatMessage;
import com.linker.backend.entity.chat.ChatRoom;
import com.linker.backend.entity.chat.ChatRoomMember;
import com.linker.backend.entity.chat.type.DmStatus;
import com.linker.backend.entity.chat.type.RequestKind;
import com.linker.backend.global.config.PlanLimits;
import com.linker.backend.global.security.RsaMaterial;
import com.linker.backend.repository.account.UserRepository;
import com.linker.backend.repository.chat.ChatMessageRepository;
import com.linker.backend.repository.chat.ChatRoomMemberRepository;
import com.linker.backend.repository.chat.ChatRoomRepository;
import com.linker.backend.repository.moderation.ReportMessageSnapshotRepository;
import com.linker.backend.service.AuthService;

import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

/**
 * POST /user/reports on chat messages: the reported line plus up to 10 readable lines on each side,
 * copied once per case from what the reporter could see (Policy ch. 9 "Chat reports").
 */
@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers
class ChatReportSnapshotIntegrationTest {

	private static final RsaMaterial KEYS = RsaMaterial.generate();
	private static final int CONTEXT = PlanLimits.REPORT_CHAT_CONTEXT_MESSAGES;

	@Container
	static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("postgres:16-alpine");

	@Container
	static final GenericContainer<?> REDIS = new GenericContainer<>("redis:7-alpine").withExposedPorts(6379);

	@DynamicPropertySource
	static void properties(DynamicPropertyRegistry registry) {
		registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
		registry.add("spring.datasource.username", POSTGRES::getUsername);
		registry.add("spring.datasource.password", POSTGRES::getPassword);
		registry.add("spring.data.redis.host", REDIS::getHost);
		registry.add("spring.data.redis.port", () -> REDIS.getMappedPort(6379));
		registry.add("linker.storage.mode", () -> "local");
		registry.add("linker.github.webhook-secret", () -> "test-webhook-secret");
		registry.add("linker.session.jwt-private-key", KEYS::privatePem);
		registry.add("linker.session.jwt-public-key", KEYS::publicPem);
		registry.add("linker.webhook.consumer-enabled", () -> "false");
		registry.add("spring.jpa.show-sql", () -> "false");
	}

	@Autowired
	private MockMvc mockMvc;
	@Autowired
	private JdbcTemplate jdbc;
	@Autowired
	private UserRepository users;
	@Autowired
	private AuthService sessions;
	@Autowired
	private ChatRoomRepository rooms;
	@Autowired
	private ChatRoomMemberRepository members;
	@Autowired
	private ChatMessageRepository messages;
	@Autowired
	private ReportMessageSnapshotRepository snapshots;

	@Test
	void teamReportCopiesTenReadableLinesOnEachSideAndSkipsDeletedHiddenAndSystemRows() throws Exception {
		User reporter = user("snap-reporter");
		User sender = user("snap-sender");
		ChatRoom team = team(reporter, sender);
		List<ChatMessage> before = new ArrayList<>();
		for (int i = 0; i < 15; i++) {
			if (i == 13) {
				messages.saveAndFlush(ChatMessage.system(team, "시스템 안내"));
			}
			before.add(messages.saveAndFlush(ChatMessage.text(team, i % 2 == 0 ? sender.getId() : reporter.getId(), "b" + i)));
		}
		deleted(before.get(13));
		hidden(before.get(10));
		ChatMessage target = messages.saveAndFlush(ChatMessage.text(team, sender.getId(), "신고할 메시지"));
		List<ChatMessage> after = new ArrayList<>();
		for (int i = 0; i < 15; i++) {
			if (i == 3) {
				messages.saveAndFlush(ChatMessage.system(team, "시스템 안내"));
			}
			after.add(messages.saveAndFlush(ChatMessage.text(team, sender.getId(), "a" + i)));
		}
		deleted(after.get(1));

		report(reporter, "TEAM_MESSAGE", target.getId()).andExpect(status().isNoContent());

		List<Long> expected = new ArrayList<>();
		for (int i : new int[] {3, 4, 5, 6, 7, 8, 9, 11, 12, 14}) {
			expected.add(before.get(i).getId());
		}
		expected.add(target.getId());
		for (int i : new int[] {0, 2, 3, 4, 5, 6, 7, 8, 9, 10}) {
			expected.add(after.get(i).getId());
		}
		List<Line> lines = lines("TEAM_MESSAGE", target.getId());
		assertThat(lines).extracting(Line::messageId).containsExactlyElementsOf(expected);
		assertThat(lines).extracting(Line::rel).containsExactlyElementsOf(range(-CONTEXT, CONTEXT));
		assertThat(lines.get(CONTEXT).body()).isEqualTo("신고할 메시지");
		assertThat(lines.get(CONTEXT - 1).body()).isEqualTo("b14");
	}

	@Test
	void roomEdgesKeepFewerLinesAndUnreadableRunsLongerThanOneBatchAreSkipped() throws Exception {
		User reporter = user("snap-edge-reporter");
		User sender = user("snap-edge-sender");
		ChatRoom team = team(reporter, sender);
		ChatMessage first = messages.saveAndFlush(ChatMessage.text(team, sender.getId(), "첫 메시지"));
		for (int i = 0; i < CONTEXT * 4; i++) {
			deleted(messages.saveAndFlush(ChatMessage.text(team, sender.getId(), "지운 메시지 " + i)));
		}
		ChatMessage late = messages.saveAndFlush(ChatMessage.text(team, reporter.getId(), "뒤 1"));
		ChatMessage last = messages.saveAndFlush(ChatMessage.text(team, sender.getId(), "뒤 2"));

		report(reporter, "TEAM_MESSAGE", first.getId()).andExpect(status().isNoContent());

		List<Line> lines = lines("TEAM_MESSAGE", first.getId());
		assertThat(lines).extracting(Line::messageId).containsExactly(first.getId(), late.getId(), last.getId());
		assertThat(lines).extracting(Line::rel).containsExactly(0, 1, 2);
	}

	@Test
	void freeTeamHistoryWindowLimitsBothTheTargetAndItsContext() throws Exception {
		User reporter = user("snap-window-reporter");
		User sender = user("snap-window-sender");
		ChatRoom team = team(reporter, sender);
		ChatMessage old = messages.saveAndFlush(ChatMessage.text(team, sender.getId(), "기간 밖"));
		ChatMessage recent = messages.saveAndFlush(ChatMessage.text(team, sender.getId(), "기간 안"));
		ChatMessage target = messages.saveAndFlush(ChatMessage.text(team, sender.getId(), "신고할 메시지"));
		Instant now = Instant.now();
		stamp(old.getId(), now.minus(Duration.ofDays(PlanLimits.TEAM_CHAT_HISTORY_DAYS_FREE)).minusSeconds(60));
		stamp(recent.getId(), now.minus(Duration.ofDays(1)));

		report(reporter, "TEAM_MESSAGE", target.getId()).andExpect(status().isNoContent());
		report(reporter, "TEAM_MESSAGE", old.getId()).andExpect(status().isNotFound());

		assertThat(lines("TEAM_MESSAGE", target.getId())).extracting(Line::messageId)
				.containsExactly(recent.getId(), target.getId());
		assertThat(caseCount("TEAM_MESSAGE", old.getId())).isZero();
	}

	@Test
	void directReportLeavesOutMessagesFromTheReportersBlockPeriods() throws Exception {
		User reporter = user("snap-dm-reporter");
		User peer = user("snap-dm-peer");
		ChatRoom room = direct(reporter, peer);
		Instant base = Instant.now().minus(Duration.ofHours(1));
		List<ChatMessage> sent = new ArrayList<>();
		for (int i = 0; i < 5; i++) {
			ChatMessage message = messages.saveAndFlush(ChatMessage.text(room, peer.getId(), "p" + i));
			stamp(message.getId(), base.plusSeconds(i * 10L));
			sent.add(message);
		}
		Instant blockedAt = base.plusSeconds(15);
		jdbc.update("""
				insert into user_blocks (blocker_id, blocked_id, unblocked_at, created_at, updated_at)
				values (?, ?, ?, ?, ?)
				""", reporter.getId(), peer.getId(), Timestamp.from(blockedAt.plusSeconds(10)),
				Timestamp.from(blockedAt), Timestamp.from(blockedAt));

		report(reporter, "DM_MESSAGE", sent.get(2).getId()).andExpect(status().isNotFound());
		report(reporter, "DM_MESSAGE", sent.get(3).getId()).andExpect(status().isNoContent());

		assertThat(lines("DM_MESSAGE", sent.get(3).getId())).extracting(Line::messageId)
				.containsExactly(sent.get(0).getId(), sent.get(1).getId(), sent.get(3).getId(), sent.get(4).getId());
	}

	@Test
	void onlyTheReportThatOpensTheCaseStoresTheSnapshot() throws Exception {
		User sender = user("snap-dup-sender");
		User first = user("snap-dup-first");
		User second = user("snap-dup-second");
		ChatRoom team = team(sender, first, second);
		ChatMessage earlier = messages.saveAndFlush(ChatMessage.text(team, sender.getId(), "앞"));
		ChatMessage target = messages.saveAndFlush(ChatMessage.text(team, sender.getId(), "신고할 메시지"));

		report(first, "TEAM_MESSAGE", target.getId()).andExpect(status().isNoContent());
		messages.saveAndFlush(ChatMessage.text(team, sender.getId(), "신고 뒤에 온 메시지"));
		report(second, "TEAM_MESSAGE", target.getId()).andExpect(status().isNoContent());
		report(first, "TEAM_MESSAGE", target.getId()).andExpect(status().isNoContent());

		assertThat(lines("TEAM_MESSAGE", target.getId())).extracting(Line::messageId)
				.containsExactly(earlier.getId(), target.getId());
		assertThat(jdbc.queryForObject("""
				select count(distinct s.report_id) from report_message_snapshots s
				join reports r on r.id = s.report_id
				join report_cases c on c.id = r.case_id
				where c.target_type = 'TEAM_MESSAGE' and c.target_id = ?
				""", Long.class, target.getId())).isEqualTo(1L);
		assertThat(jdbc.queryForObject(
				"select reporter_count from report_cases where target_type = 'TEAM_MESSAGE' and target_id = ?",
				Integer.class, target.getId())).isEqualTo(2);
	}

	@Test
	void reportsOutsideTheReportersViewAreRejectedWithoutOpeningACase() throws Exception {
		User reporter = user("snap-deny-reporter");
		User sender = user("snap-deny-sender");
		User outsider = user("snap-deny-outsider");
		ChatRoom team = team(reporter, sender);
		ChatRoom dm = direct(reporter, sender);
		ChatMessage teamLine = messages.saveAndFlush(ChatMessage.text(team, sender.getId(), "팀 메시지"));
		ChatMessage dmLine = messages.saveAndFlush(ChatMessage.text(dm, sender.getId(), "1:1 메시지"));
		ChatMessage gone = deleted(messages.saveAndFlush(ChatMessage.text(team, sender.getId(), "지운 메시지")));
		ChatMessage hiddenLine = hidden(messages.saveAndFlush(ChatMessage.text(team, sender.getId(), "숨긴 메시지")));
		ChatMessage notice = messages.saveAndFlush(ChatMessage.system(team, "시스템 안내"));
		ChatMessage own = messages.saveAndFlush(ChatMessage.text(team, reporter.getId(), "내 메시지"));

		report(reporter, "DM_MESSAGE", teamLine.getId()).andExpect(status().isNotFound());
		report(reporter, "TEAM_MESSAGE", dmLine.getId()).andExpect(status().isNotFound());
		report(outsider, "TEAM_MESSAGE", teamLine.getId()).andExpect(status().isNotFound());
		report(reporter, "TEAM_MESSAGE", gone.getId()).andExpect(status().isNotFound());
		report(reporter, "TEAM_MESSAGE", hiddenLine.getId()).andExpect(status().isNotFound());
		report(reporter, "TEAM_MESSAGE", notice.getId()).andExpect(status().isNotFound());
		report(reporter, "TEAM_MESSAGE", Long.MAX_VALUE).andExpect(status().isNotFound());
		report(reporter, "TEAM_MESSAGE", own.getId()).andExpect(status().isBadRequest());

		for (ChatMessage message : List.of(teamLine, gone, hiddenLine, notice, own)) {
			assertThat(caseCount("TEAM_MESSAGE", message.getId())).isZero();
		}
		assertThat(caseCount("DM_MESSAGE", teamLine.getId())).isZero();
		assertThat(caseCount("TEAM_MESSAGE", dmLine.getId())).isZero();
	}

	private record Line(int rel, long messageId, String body) {
	}

	private List<Line> lines(String targetType, long messageId) {
		List<Long> caseIds = jdbc.queryForList(
				"select id from report_cases where target_type = ? and target_id = ?", Long.class, targetType, messageId);
		assertThat(caseIds).hasSize(1);
		return snapshots.findByReport_ReportCase_IdOrderByRelPositionAsc(caseIds.get(0)).stream()
				.map(line -> new Line(line.getRelPosition(), line.getMessageId(), line.getBody()))
				.toList();
	}

	private long caseCount(String targetType, long messageId) {
		return jdbc.queryForObject("select count(*) from report_cases where target_type = ? and target_id = ?",
				Long.class, targetType, messageId);
	}

	private static List<Integer> range(int from, int to) {
		List<Integer> values = new ArrayList<>();
		for (int i = from; i <= to; i++) {
			values.add(i);
		}
		return values;
	}

	private ResultActions report(User reporter, String targetType, long messageId) throws Exception {
		return mockMvc.perform(post("/api/v1/user/reports")
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"targetType\":\"%s\",\"targetId\":%d,\"reason\":\"ABUSE\"}".formatted(targetType, messageId))
				.cookie(cookie(reporter)));
	}

	private ChatMessage deleted(ChatMessage message) {
		message.delete(Instant.now());
		return messages.saveAndFlush(message);
	}

	private ChatMessage hidden(ChatMessage message) {
		message.hide();
		return messages.saveAndFlush(message);
	}

	private void stamp(long messageId, Instant createdAt) {
		jdbc.update("update chat_messages set created_at = ? where id = ?", Timestamp.from(createdAt), messageId);
	}

	private ChatRoom team(User... people) {
		ChatRoom room = rooms.saveAndFlush(ChatRoom.team(null));
		for (User person : people) {
			members.saveAndFlush(ChatRoomMember.join(room, person.getId()));
		}
		return room;
	}

	private ChatRoom direct(User requester, User recipient) {
		ChatRoom room = rooms.saveAndFlush(ChatRoom.direct(
				requester.getId(), recipient.getId(), DmStatus.ACCEPTED, RequestKind.GENERAL, null));
		members.saveAndFlush(ChatRoomMember.join(room, requester.getId()));
		members.saveAndFlush(ChatRoomMember.join(room, recipient.getId()));
		return room;
	}

	private User user(String prefix) {
		return users.saveAndFlush(User.create(prefix + "-" + System.nanoTime(), UserType.DEVELOPER));
	}

	private Cookie cookie(User user) {
		return new Cookie("linker_session", sessions.issue(user, "JUnit", "127.0.0.1").rawToken());
	}
}
