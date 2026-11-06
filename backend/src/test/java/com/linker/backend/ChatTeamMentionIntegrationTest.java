package com.linker.backend;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.reset;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import com.linker.backend.dto.chat.response.ChatMemberResponse;
import com.linker.backend.entity.account.User;
import com.linker.backend.entity.account.type.UserType;
import com.linker.backend.entity.chat.ChatRoom;
import com.linker.backend.entity.chat.ChatRoomMember;
import com.linker.backend.entity.chat.type.DmStatus;
import com.linker.backend.entity.chat.type.RequestKind;
import com.linker.backend.global.realtime.StompAuthException;
import com.linker.backend.global.realtime.TeamChatAccess;
import com.linker.backend.global.security.RsaMaterial;
import com.linker.backend.repository.account.UserRepository;
import com.linker.backend.repository.chat.ChatRoomMemberRepository;
import com.linker.backend.repository.chat.ChatRoomRepository;
import com.linker.backend.service.user.ChatService;
import com.linker.backend.support.TeamTestFixtures;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

/**
 * Team chat mentions (Policy ch. 8): what is stored, who is notified with which type, and what is
 * dropped or rejected. Push behaviour (muted rooms, quiet hours, bundling) is in
 * {@code NotificationDeliveryIntegrationTest}. {@link TeamChatAccess} is stubbed the same way {@code ChatTextIntegrationTest} does, but the room
 * points at a real V20 team row because {@code chat_rooms.team_id} is a foreign key.
 */
@SpringBootTest
@Testcontainers
class ChatTeamMentionIntegrationTest {

	private static final RsaMaterial KEYS = RsaMaterial.generate();

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

	@MockitoBean
	private SimpMessagingTemplate messaging;
	@MockitoSpyBean
	private TeamChatAccess teamChat;

	@Autowired
	private JdbcTemplate jdbc;
	@Autowired
	private UserRepository users;
	@Autowired
	private ChatRoomRepository rooms;
	@Autowired
	private ChatRoomMemberRepository members;
	@Autowired
	private ChatService chat;

	@AfterEach
	void resetStubs() {
		reset(teamChat);
	}

	@Test
	void personMentionIsStoredAndNotifiesOnlyThatPersonAsAMention() {
		Team team = team();
		chat.sendMessage(team.owner.getId(), team.room.getId(), message("안녕 @alice", List.of(team.alice.getId())));

		assertThat(mentionRows(team)).containsExactly(team.alice.getId() + ":false");
		assertThat(notificationsOf(team)).containsExactly(team.alice.getId() + ":CHAT_MENTION");
		Map<String, Object> row = jdbc.queryForMap("""
				select actor_id, target_type, link_path, group_key, deliver_after, payload::text as payload
				from notifications where target_id = ?
				""", team.room.getId());
		assertThat(row.get("actor_id")).isEqualTo(team.owner.getId());
		assertThat(row.get("target_type")).isEqualTo("CHAT_ROOM");
		assertThat(row.get("link_path")).isEqualTo("/chats/" + team.room.getId());
		assertThat(row.get("group_key")).isEqualTo("chat:" + team.room.getId());
		assertThat(row.get("deliver_after")).as("chat skips quiet hours").isNull();
		assertThat((String) row.get("payload")).contains("\"mention\": true");
	}

	@Test
	void plainTeamMessageCreatesNoNotificationAndNoMention() {
		Team team = team();
		chat.sendMessage(team.owner.getId(), team.room.getId(), message("공지 아님", List.of()));

		assertThat(messageCount(team)).isEqualTo(1);
		assertThat(mentionRows(team)).isEmpty();
		assertThat(notificationsOf(team)).isEmpty();
	}

	@Test
	void allMentionNotifiesEveryoneElseAndAPersonNamedAlsoGetsOnlyTheMention() {
		Team team = team();
		chat.sendMessage(team.owner.getId(), team.room.getId(), message("@전체 회의해요", List.of(team.alice.getId())));

		assertThat(mentionRows(team)).containsExactlyInAnyOrder(team.alice.getId() + ":false", "null:true");
		assertThat(notificationsOf(team)).containsExactlyInAnyOrder(
				team.alice.getId() + ":CHAT_MENTION",
				team.bob.getId() + ":CHAT");
		assertThat(jdbc.queryForObject(
				"select payload::text from notifications where target_id = ? and user_id = ?",
				String.class, team.room.getId(), team.bob.getId())).contains("\"mentionAll\": true");
	}

	@Test
	void idsThatAreNotMentionableActiveTeamMembersAreDroppedButTheMessageIsSent() {
		Team team = team();
		User stranger = user("stranger");
		User leftTeam = user("left-team");
		members.saveAndFlush(ChatRoomMember.join(team.room, leftTeam.getId()));
		List<Long> ids = List.of(team.owner.getId(), stranger.getId(), leftTeam.getId(), team.alice.getId(), 987_654_321L);

		chat.sendMessage(team.owner.getId(), team.room.getId(), message("여러명", ids));

		assertThat(messageCount(team)).isEqualTo(1);
		assertThat(mentionRows(team)).containsExactly(team.alice.getId() + ":false");
		assertThat(notificationsOf(team)).containsExactly(team.alice.getId() + ":CHAT_MENTION");
	}

	@Test
	void repeatedIdsCollapseToOneMentionAndOneNotification() {
		Team team = team();
		chat.sendMessage(team.owner.getId(), team.room.getId(),
				message("@alice @alice", List.of(team.alice.getId(), team.alice.getId())));

		assertThat(mentionRows(team)).hasSize(1);
		assertThat(notificationsOf(team)).hasSize(1);
	}

	@Test
	void resendingTheSameMessageDoesNotMentionTwice() {
		Team team = team();
		Map<String, Object> payload = message("@alice 확인", List.of(team.alice.getId()));
		chat.sendMessage(team.owner.getId(), team.room.getId(), payload);
		chat.sendMessage(team.owner.getId(), team.room.getId(), payload);

		assertThat(messageCount(team)).isEqualTo(1);
		assertThat(mentionRows(team)).hasSize(1);
		assertThat(notificationsOf(team)).hasSize(1);
	}

	@Test
	void directRoomsRejectMentionsAndStoreNothing() {
		User sender = user("dm-sender");
		User other = user("dm-other");
		ChatRoom room = rooms.saveAndFlush(ChatRoom.direct(
				sender.getId(), other.getId(), DmStatus.ACCEPTED, RequestKind.GENERAL, null));
		members.saveAndFlush(ChatRoomMember.join(room, sender.getId()));
		members.saveAndFlush(ChatRoomMember.join(room, other.getId()));

		assertThatThrownBy(() -> chat.sendMessage(sender.getId(), room.getId(), message("@other", List.of(other.getId()))))
				.isInstanceOf(StompAuthException.class);
		assertThat(jdbc.queryForObject("select count(*) from chat_messages where room_id = ?", Long.class, room.getId())).isZero();
		assertThat(jdbc.queryForObject("""
				select count(*) from chat_message_mentions m join chat_messages c on c.id = m.message_id
				where c.room_id = ?
				""", Long.class, room.getId())).isZero();
	}

	@Test
	void malformedOrOversizedIdListsAreRejected() {
		Team team = team();
		for (Object bad : new Object[] {"alice", List.of("abc"), List.of(0), List.of(-3), List.of(1.5)}) {
			Map<String, Object> payload = message("잘못", List.of());
			payload.put("mentionedUserIds", bad);
			assertThatThrownBy(() -> chat.sendMessage(team.owner.getId(), team.room.getId(), payload))
					.as("mentionedUserIds=%s", bad).isInstanceOf(StompAuthException.class);
		}
		List<Long> tooMany = new ArrayList<>();
		for (long id = 1; id <= 101; id++) {
			tooMany.add(id);
		}
		assertThatThrownBy(() -> chat.sendMessage(team.owner.getId(), team.room.getId(), message("너무 많음", tooMany)))
				.isInstanceOf(StompAuthException.class);
		assertThat(messageCount(team)).isZero();
	}

	@Test
	void nonModeratorCannotAllMentionEvenWithPersonMentions() {
		Team team = team();
		doReturn(false).when(teamChat).canModerate(team.alice.getId(), team.teamId);

		chat.sendMessage(team.alice.getId(), team.room.getId(), message("@all 나도", List.of(team.bob.getId())));

		assertThat(messageCount(team)).isZero();
		assertThat(mentionRows(team)).isEmpty();
		assertThat(notificationsOf(team)).isEmpty();
	}

	// ---- fixtures --------------------------------------------------------------------

	private record Team(long teamId, ChatRoom room, User owner, User alice, User bob) {
	}

	/** A team room with an owner who may moderate, plus two ordinary members. */
	private Team team() {
		User owner = user("owner");
		User alice = user("alice");
		User bob = user("bob");
		long teamId = TeamTestFixtures.team(jdbc, owner.getId(), "mention-" + System.nanoTime(), "ACTIVE");
		ChatRoom room = rooms.saveAndFlush(ChatRoom.team(teamId));
		for (User member : List.of(owner, alice, bob)) {
			members.saveAndFlush(ChatRoomMember.join(room, member.getId()));
		}
		doReturn(true).when(teamChat).writableBy(anyLong(), eq(teamId));
		doReturn(true).when(teamChat).canModerate(owner.getId(), teamId);
		doReturn(List.of(candidate(owner), candidate(alice), candidate(bob)))
				.when(teamChat).mentionCandidates(anyLong(), eq(teamId));
		return new Team(teamId, room, owner, alice, bob);
	}

	private static ChatMemberResponse candidate(User user) {
		return new ChatMemberResponse(user.getId(), user.getUsername(), user.getUsername(), null);
	}

	private User user(String prefix) {
		return users.saveAndFlush(User.create(prefix + "-" + System.nanoTime(), UserType.DEVELOPER));
	}

	private static Map<String, Object> message(String text, Object mentionedUserIds) {
		Map<String, Object> payload = new HashMap<>();
		payload.put("clientMessageId", UUID.randomUUID().toString());
		payload.put("text", text);
		payload.put("mentionedUserIds", mentionedUserIds);
		return payload;
	}

	private long messageCount(Team team) {
		return jdbc.queryForObject("select count(*) from chat_messages where room_id = ?", Long.class, team.room.getId());
	}

	/** {@code mentioned_user_id:mention_all} per stored mention of this room. */
	private List<String> mentionRows(Team team) {
		return jdbc.queryForList("""
				select coalesce(m.mentioned_user_id::text, 'null') || ':' || m.mention_all as row
				from chat_message_mentions m join chat_messages c on c.id = m.message_id
				where c.room_id = ?
				""", String.class, team.room.getId());
	}

	/** {@code user_id:notification_type} per notification about this room. */
	private List<String> notificationsOf(Team team) {
		return jdbc.queryForList(
				"select user_id || ':' || notification_type from notifications where target_id = ?",
				String.class, team.room.getId());
	}
}
