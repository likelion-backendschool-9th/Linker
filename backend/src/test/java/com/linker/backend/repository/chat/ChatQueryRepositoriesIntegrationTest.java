package com.linker.backend.repository.chat;

import static org.assertj.core.api.Assertions.assertThat;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;

import com.linker.backend.dto.chat.response.ChatShareCardResponse;
import com.linker.backend.entity.account.User;
import com.linker.backend.entity.account.type.UserType;
import com.linker.backend.entity.chat.ChatMessage;
import com.linker.backend.entity.chat.ChatRoom;
import com.linker.backend.entity.chat.ChatRoomMember;
import com.linker.backend.entity.chat.type.DmStatus;
import com.linker.backend.entity.chat.type.RequestKind;
import com.linker.backend.global.security.RsaMaterial;
import com.linker.backend.repository.account.UserRepository;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

/**
 * Pins the behaviour of the chat read queries (message history, share cards, recruiting offers)
 * so the JdbcTemplate to JPA move can be compared against it. Fixtures use JdbcTemplate on purpose.
 * Room list/summary/tab membership is pinned by {@code ChatListIntegrationTest}.
 */
@SpringBootTest
@Testcontainers
class ChatQueryRepositoriesIntegrationTest {

	private static final RsaMaterial KEYS = RsaMaterial.generate();
	private static final Instant T0 = Instant.parse("2026-01-01T00:00:00Z");

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

	@Autowired
	private JdbcTemplate jdbc;
	@Autowired
	private UserRepository users;
	@Autowired
	private ChatRoomRepository rooms;
	@Autowired
	private ChatRoomMemberRepository members;
	@Autowired
	private ChatMessageRepository messages;

	// ---- message history -------------------------------------------------------------

	@Test
	void historyPagesInIdOrderAndReportsSenderAndUnread() {
		User a = named("hist-a", "에이");
		User b = user("hist-b");
		ChatRoom room = direct(a, b, DmStatus.ACCEPTED, RequestKind.GENERAL);
		long m1 = message(room, a, "하나", T0);
		long m2 = message(room, b, "둘", T0.plusSeconds(1));
		long m3 = message(room, a, "셋", T0.plusSeconds(2));
		jdbc.update("update chat_room_members set last_read_message_id = ? where room_id = ? and user_id = ?",
				m1, room.getId(), b.getId());

		List<ChatMessageRepositoryCustom.ChatMessageRow> latest = latest(a, room, false, null, 2);
		assertThat(latest).extracting(ChatMessageRepositoryCustom.ChatMessageRow::id).containsExactly(m2, m3);

		List<ChatMessageRepositoryCustom.ChatMessageRow> all = latest(a, room, false, null, 10);
		assertThat(all).extracting(ChatMessageRepositoryCustom.ChatMessageRow::id).containsExactly(m1, m2, m3);
		assertThat(before(a, room, false, null, m3, 10))
				.extracting(ChatMessageRepositoryCustom.ChatMessageRow::id).containsExactly(m1, m2);
		assertThat(before(a, room, false, null, m3, 1))
				.extracting(ChatMessageRepositoryCustom.ChatMessageRow::id).containsExactly(m2);
		assertThat(after(a, room, false, null, m1, 10))
				.extracting(ChatMessageRepositoryCustom.ChatMessageRow::id).containsExactly(m2, m3);
		assertThat(after(a, room, false, null, m1, 1))
				.extracting(ChatMessageRepositoryCustom.ChatMessageRow::id).containsExactly(m2);

		ChatMessageRepositoryCustom.ChatMessageRow first = all.get(0);
		assertThat(first.roomId()).isEqualTo(room.getId());
		assertThat(first.senderId()).isEqualTo(a.getId());
		assertThat(first.username()).isEqualTo(a.getUsername());
		assertThat(first.displayName()).isEqualTo("에이");
		assertThat(first.type()).isEqualTo("TEXT");
		assertThat(first.body()).isEqualTo("하나");
		assertThat(first.visibility()).isEqualTo("VISIBLE");
		assertThat(first.deletedAt()).isNull();
		assertThat(first.createdAt()).isEqualTo(T0);
		// unread = other active members whose last read is before the message
		assertThat(all.get(0).unreadCount()).isZero();
		assertThat(all.get(1).unreadCount()).isEqualTo(1);
		assertThat(all.get(2).unreadCount()).isEqualTo(1);
	}

	@Test
	void searchFindsVisibleTextByPartialCaseInsensitiveMatchNewestFirstAndHonorsCutoff() {
		User a = user("search-a");
		User b = user("search-b");
		ChatRoom room = direct(a, b, DmStatus.ACCEPTED, RequestKind.GENERAL);
		long old = message(room, a, "Design 오래된 기록", T0.minusSeconds(1));
		long newest = message(room, b, "새 DESIGN 검토", T0.plusSeconds(2));
		long literal = message(room, a, "진행률 100% 확인", T0.plusSeconds(3));
		long hidden = message(room, a, "design 숨김", T0.plusSeconds(4));
		jdbc.update("update chat_messages set visibility = 'HIDDEN' where id = ?", hidden);

		assertThat(messages.search(room.getId(), null, "design"))
				.extracting(ChatMessageRepositoryCustom.ChatMessageRow::id)
				.containsExactly(newest, old);
		assertThat(messages.search(room.getId(), T0, "design"))
				.extracting(ChatMessageRepositoryCustom.ChatMessageRow::id)
				.containsExactly(newest);
		assertThat(messages.search(room.getId(), null, "100%"))
				.extracting(ChatMessageRepositoryCustom.ChatMessageRow::id)
				.containsExactly(literal);
	}

	@Test
	void systemMessagesHaveNoSenderAndCountEveryActiveMemberUnread() {
		User a = user("sys-a");
		User b = user("sys-b");
		ChatRoom room = direct(a, b, DmStatus.ACCEPTED, RequestKind.GENERAL);
		long id = jdbc.queryForObject("""
				insert into chat_messages(room_id, sender_id, message_type, body, visibility, created_at, updated_at)
				values (?, null, 'SYSTEM', '안내', 'VISIBLE', ?, ?) returning id
				""", Long.class, room.getId(), Timestamp.from(T0), Timestamp.from(T0));

		ChatMessageRepositoryCustom.ChatMessageRow row = latest(a, room, false, null, 10).get(0);
		assertThat(row.id()).isEqualTo(id);
		assertThat(row.senderId()).isNull();
		assertThat(row.username()).isNull();
		assertThat(row.unreadCount()).isEqualTo(2);
	}

	@Test
	void payloadIsReturnedAsJsonbText() {
		User a = user("pay-a");
		User b = user("pay-b");
		ChatRoom room = direct(a, b, DmStatus.ACCEPTED, RequestKind.GENERAL);
		jdbc.update("""
				insert into chat_messages(room_id, sender_id, message_type, body, payload, visibility, created_at, updated_at)
				values (?, ?, 'SHARE_CARD', null, '{"targetType":"POST","targetId":1}'::jsonb, 'VISIBLE', ?, ?)
				""", room.getId(), a.getId(), Timestamp.from(T0), Timestamp.from(T0));

		ChatMessageRepositoryCustom.ChatMessageRow row = latest(a, room, false, null, 1).get(0);
		assertThat(row.type()).isEqualTo("SHARE_CARD");
		assertThat(row.body()).isNull();
		assertThat(row.payload()).isEqualTo("{\"targetId\": 1, \"targetType\": \"POST\"}");
	}

	@Test
	void directBlockPeriodHidesOnlyMessagesCreatedInsideIt() {
		User viewer = user("blk-viewer");
		User other = user("blk-other");
		ChatRoom room = direct(viewer, other, DmStatus.ACCEPTED, RequestKind.GENERAL);
		long before = message(room, other, "차단 전", T0);
		long during = message(room, other, "차단 중", T0.plus(2, ChronoUnit.DAYS));
		long afterUnblock = message(room, other, "해제 후", T0.plus(6, ChronoUnit.DAYS));
		long own = message(room, viewer, "내 글", T0.plus(2, ChronoUnit.DAYS).plusSeconds(1));
		jdbc.update("""
				insert into user_blocks(blocker_id, blocked_id, created_at, unblocked_at, updated_at)
				values (?, ?, ?, ?, now())
				""", viewer.getId(), other.getId(), Timestamp.from(T0.plus(1, ChronoUnit.DAYS)),
				Timestamp.from(T0.plus(5, ChronoUnit.DAYS)));

		assertThat(latest(viewer, room, false, null, 10))
				.extracting(ChatMessageRepositoryCustom.ChatMessageRow::id)
				.containsExactly(before, afterUnblock, own);
		assertThat(visibleTo(viewer, room, false, null, during)).isFalse();
		assertThat(visibleTo(viewer, room, false, null, before)).isTrue();
		// the period is half-open: the blocked person's own view is not filtered
		assertThat(latest(other, room, false, null, 10))
				.extracting(ChatMessageRepositoryCustom.ChatMessageRow::id)
				.containsExactly(before, during, afterUnblock, own);
	}

	@Test
	void teamRoomsIgnoreBlocksAndHistoryStartCutsOlderMessages() {
		User viewer = user("team-viewer");
		User other = user("team-other");
		long teamId = com.linker.backend.support.TeamTestFixtures.team(jdbc, viewer.getId(), "조회 테스트 팀", "ACTIVE");
		ChatRoom room = rooms.saveAndFlush(ChatRoom.team(teamId));
		members.saveAndFlush(ChatRoomMember.join(room, viewer.getId()));
		members.saveAndFlush(ChatRoomMember.join(room, other.getId()));
		long old = message(room, other, "예전", T0);
		long recent = message(room, other, "최근", T0.plus(10, ChronoUnit.DAYS));
		jdbc.update("insert into user_blocks(blocker_id, blocked_id, created_at, updated_at) values (?, ?, ?, now())",
				viewer.getId(), other.getId(), Timestamp.from(T0.minusSeconds(60)));

		assertThat(latest(viewer, room, true, null, 10))
				.extracting(ChatMessageRepositoryCustom.ChatMessageRow::id).containsExactly(old, recent);
		assertThat(latest(viewer, room, true, T0.plus(5, ChronoUnit.DAYS), 10))
				.extracting(ChatMessageRepositoryCustom.ChatMessageRow::id).containsExactly(recent);
		assertThat(visibleTo(viewer, room, true, T0.plus(5, ChronoUnit.DAYS), old)).isFalse();
		assertThat(visibleTo(viewer, room, true, null, old)).isTrue();
	}

	@Test
	void roomIdOfAndImageUrlsFollowSortOrderAndSkipMissingUrls() {
		User a = user("img-a");
		User b = user("img-b");
		ChatRoom room = direct(a, b, DmStatus.ACCEPTED, RequestKind.GENERAL);
		long withImages = message(room, a, "사진", T0);
		long plain = message(room, a, "글", T0.plusSeconds(1));
		long f1 = file(a, "https://cdn.example/1.png");
		long f2 = file(a, "https://cdn.example/2.png");
		long f3 = file(a, null);
		image(withImages, f2, 2);
		image(withImages, f1, 1);
		image(withImages, f3, 3);

		assertThat(roomIdOf(withImages)).isEqualTo(room.getId());
		assertThat(roomIdOf(-1L)).isNull();
		Map<Long, List<String>> urls = imageUrls(List.of(withImages, plain));
		assertThat(urls).containsOnlyKeys(withImages);
		assertThat(urls.get(withImages)).containsExactly("https://cdn.example/1.png", "https://cdn.example/2.png");
		assertThat(imageUrls(List.of())).isEmpty();
	}

	// ---- share cards -----------------------------------------------------------------

	@Test
	void postCardResolvesFirstImageAndHidesUnavailableOrBlockedPosts() {
		User viewer = user("card-viewer");
		User author = user("card-author");
		long repoId = repo();
		String repoName = jdbc.queryForObject("select full_name from github_repos where id = ?", String.class, repoId);
		long visible = post(author, repoId, "보이는 글", "VISIBLE", false);
		long hidden = post(author, repo(), "숨김 글", "HIDDEN", false);
		long deleted = post(author, repo(), "삭제 글", "VISIBLE", true);
		image(visible, "post_images", "post_id", file(author, "https://cdn.example/second.png"), 2);
		image(visible, "post_images", "post_id", file(author, "https://cdn.example/first.png"), 1);

		ChatShareCardResponse card = resolve(viewer, "POST", visible);
		assertThat(card).isEqualTo(new ChatShareCardResponse(
				"POST", visible, repoName, "보이는 글 · " + author.getUsername(), "https://cdn.example/first.png",
				"/posts/" + visible + "?from=chat_share", true));
		assertThat(resolve(viewer, "POST", hidden)).isEqualTo(ChatShareCardResponse.unavailable("POST", hidden));
		assertThat(resolve(viewer, "POST", deleted)).isEqualTo(ChatShareCardResponse.unavailable("POST", deleted));
		assertThat(resolve(viewer, "POST", -5)).isEqualTo(ChatShareCardResponse.unavailable("POST", -5));

		block(viewer, author, false);
		assertThat(resolve(viewer, "POST", visible).available()).isFalse();
		// blocks count in both directions: the author blocking a viewer hides the post from that viewer too
		User blockedByAuthor = user("card-blocked");
		block(author, blockedByAuthor, false);
		assertThat(resolve(blockedByAuthor, "POST", visible).available()).isFalse();
		assertThat(resolve(author, "POST", visible).available()).isTrue();
		assertThat(resolve(user("card-other"), "POST", visible).available()).isTrue();
	}

	@Test
	void postCardWithoutImageHasNullImageAndDeletedAuthorMakesItUnavailable() {
		User viewer = user("card2-viewer");
		User author = user("card2-author");
		long id = post(author, repo(), "글", "VISIBLE", false);
		assertThat(resolve(viewer, "POST", id).imageUrl()).isNull();
		jdbc.update("update users set status = 'DELETED' where id = ?", author.getId());
		assertThat(resolve(viewer, "POST", id).available()).isFalse();
	}

	@Test
	void recruitCardAndProfileCardFollowTheSameVisibilityRules() {
		User viewer = user("card3-viewer");
		User author = named("card3-author", "작성자");
		long recruit = recruitPost(author, "팀원 구해요", "함께해요", "VISIBLE", false);
		long hidden = recruitPost(author, "숨김", "x", "HIDDEN", false);

		assertThat(resolve(viewer, "RECRUIT_POST", recruit)).isEqualTo(new ChatShareCardResponse(
				"RECRUIT_POST", recruit, "팀원 구해요", jdbc.queryForObject("select deadline from recruit_posts where id = ?", java.time.LocalDate.class, recruit) + " 마감", null,
				"/recruits/" + recruit + "?from=chat_share", true));
		assertThat(resolve(viewer, "RECRUIT_POST", hidden).available()).isFalse();

		assertThat(resolve(viewer, "PROFILE", author.getId())).isEqualTo(new ChatShareCardResponse(
				"PROFILE", author.getId(), "작성자", "@" + author.getUsername(), null,
				"/user/" + author.getUsername(), true));
		User noName = user("card3-noname");
		assertThat(resolve(viewer, "PROFILE", noName.getId()).title()).isEqualTo(noName.getUsername());

		block(author, viewer, false);
		assertThat(resolve(viewer, "RECRUIT_POST", recruit).available()).isFalse();
		assertThat(resolve(viewer, "PROFILE", author.getId()).available()).isFalse();
		// a lifted block no longer hides anything
		jdbc.update("update user_blocks set unblocked_at = now() where blocker_id = ?", author.getId());
		assertThat(resolve(viewer, "PROFILE", author.getId()).available()).isTrue();
		assertThat(resolve(viewer, "UNKNOWN", 1)).isEqualTo(ChatShareCardResponse.unavailable("UNKNOWN", 1));
	}

	// ---- recruiting offers -----------------------------------------------------------

	@Test
	void cardDetailsTrackPrivateReposRemainingRecruitRolesAndOrderedTechTags() {
		User viewer = user("detail-viewer");
		User author = named("detail-author", "공유 작성자");
		long repoId = repo();
		long postId = post(author, repoId, "프로젝트 소개", "VISIBLE", false);
		jdbc.update("update github_repos set is_private=true where id=?", repoId);
		assertThat(resolve(viewer, "POST", postId).title()).isEqualTo("레포를 볼 수 없음");
		assertThat(resolve(viewer, "POST", postId).summary()).isEqualTo("프로젝트 소개 · 공유 작성자");
		long recruit = recruitPost(author, "팀 모집", "상세 본문", "VISIBLE", false);
		jdbc.update("insert into recruit_roles(recruit_post_id,role,headcount,accepted_count,created_at,updated_at) values (?,'BACKEND',3,1,now(),now())", recruit);
		assertThat(resolve(viewer, "RECRUIT_POST", recruit).summary()).contains("백엔드 2명", "마감");
		jdbc.update("update recruit_roles set accepted_count=3 where recruit_post_id=?", recruit);
		jdbc.update("update recruit_posts set status='CLOSED',closed_at=now() where id=?", recruit);
		assertThat(resolve(viewer, "RECRUIT_POST", recruit).summary()).contains("백엔드 0명", "모집 마감");
		String first = "CardA-" + System.nanoTime();
		String second = "CardB-" + System.nanoTime();
		userTag(author, tag(second, 20));
		userTag(author, tag(first, 10));
		assertThat(resolve(viewer, "PROFILE", author.getId()).summary()).isEqualTo("@" + author.getUsername() + " · " + first + ", " + second);
	}

	@Test
	void offersListNewestFirstWithFirstTextMessageAndTopThreeTags() {
		User recruiter = recruiter("off-rec");
		User dev1 = named("off-dev1", "개발자1");
		User dev2 = user("off-dev2");
		long java = tag("QJava", 1);
		long spring = tag("QSpring", 2);
		long kotlin = tag("QKotlin", 3);
		long go = tag("QGo", 4);
		userTag(dev1, go);
		userTag(dev1, spring);
		userTag(dev1, java);
		userTag(dev1, kotlin);

		ChatRoom older = direct(recruiter, dev1, DmStatus.REQUESTED, RequestKind.RECRUITING);
		ChatRoom newer = direct(recruiter, dev2, DmStatus.ACCEPTED, RequestKind.RECRUITING);
		stampRoom(older, T0);
		stampRoom(newer, T0.plusSeconds(100));
		message(older, dev1, "답장 먼저", T0.plusSeconds(1));
		message(older, recruiter, "첫 제안", T0.plusSeconds(2));
		message(older, recruiter, "두번째", T0.plusSeconds(3));
		// a non-recruiting direct room and someone else's offer stay out
		direct(recruiter, user("off-x"), DmStatus.ACCEPTED, RequestKind.GENERAL);
		direct(recruiter("off-rec2"), dev1, DmStatus.REQUESTED, RequestKind.RECRUITING);

		List<ChatRoomRepositoryCustom.OfferRow> rows = offers(recruiter);
		assertThat(rows).extracting(ChatRoomRepositoryCustom.OfferRow::roomId).containsExactly(newer.getId(), older.getId());

		ChatRoomRepositoryCustom.OfferRow oldest = rows.get(1);
		assertThat(oldest.dmStatus()).isEqualTo("REQUESTED");
		assertThat(oldest.developerId()).isEqualTo(dev1.getId());
		assertThat(oldest.username()).isEqualTo(dev1.getUsername());
		assertThat(oldest.displayName()).isEqualTo("개발자1");
		assertThat(oldest.firstBody()).isEqualTo("첫 제안");
		assertThat(oldest.firstAt()).isEqualTo(T0.plusSeconds(2));
		assertThat(oldest.techStack()).containsExactly("QJava", "QSpring", "QKotlin");
		assertThat(oldest.createdAt()).isEqualTo(T0);

		ChatRoomRepositoryCustom.OfferRow noMessage = rows.get(0);
		assertThat(noMessage.firstBody()).isNull();
		assertThat(noMessage.firstAt()).isNull();
		assertThat(noMessage.techStack()).isEmpty();
	}

	@Test
	void offerCountsAndFirstMessageAreScopedToTheRequester() {
		User recruiter = recruiter("cnt-rec");
		User dev = user("cnt-dev");
		ChatRoom room = direct(recruiter, dev, DmStatus.REQUESTED, RequestKind.RECRUITING);
		ChatRoom empty = direct(recruiter, user("cnt-dev2"), DmStatus.REQUESTED, RequestKind.RECRUITING);
		stampRoom(room, T0.plus(3, ChronoUnit.DAYS));
		stampRoom(empty, T0.minus(3, ChronoUnit.DAYS));
		message(room, recruiter, "안녕하세요", T0.plus(3, ChronoUnit.DAYS).plusSeconds(1));

		assertThat(sentSince(recruiter, T0)).isEqualTo(1);
		assertThat(sentSince(recruiter, T0.minus(10, ChronoUnit.DAYS))).isEqualTo(2);
		assertThat(sentSince(dev, T0.minus(10, ChronoUnit.DAYS))).isZero();

		ChatRoomRepositoryCustom.OfferMessage message = firstMessage(recruiter, room.getId());
		assertThat(message.body()).isEqualTo("안녕하세요");
		assertThat(message.sentAt()).isEqualTo(T0.plus(3, ChronoUnit.DAYS).plusSeconds(1));
		// room exists but nothing was sent: a row with nulls, not "not found"
		ChatRoomRepositoryCustom.OfferMessage none = firstMessage(recruiter, empty.getId());
		assertThat(none).isNotNull();
		assertThat(none.body()).isNull();
		assertThat(none.sentAt()).isNull();
		assertThat(firstMessage(dev, room.getId())).isNull();
		assertThat(firstMessage(recruiter, -1L)).isNull();
	}

	// ---- adapters: only these change when the repositories move -------------------

	private List<ChatMessageRepositoryCustom.ChatMessageRow> latest(User viewer, ChatRoom room, boolean team, Instant start, int limit) {
		return messages.latest(viewer.getId(), room.getId(), team, start, limit);
	}

	private List<ChatMessageRepositoryCustom.ChatMessageRow> before(User viewer, ChatRoom room, boolean team, Instant start, long anchor, int limit) {
		return messages.before(viewer.getId(), room.getId(), team, start, anchor, limit);
	}

	private List<ChatMessageRepositoryCustom.ChatMessageRow> after(User viewer, ChatRoom room, boolean team, Instant start, long anchor, int limit) {
		return messages.after(viewer.getId(), room.getId(), team, start, anchor, limit);
	}

	private boolean visibleTo(User viewer, ChatRoom room, boolean team, Instant start, long messageId) {
		return messages.visibleTo(viewer.getId(), room.getId(), team, start, messageId);
	}

	private Long roomIdOf(long messageId) {
		return messages.findRoomId(messageId).orElse(null);
	}

	private Map<Long, List<String>> imageUrls(List<Long> ids) {
		return messages.imageUrls(ids);
	}

	private ChatShareCardResponse resolve(User viewer, String type, long id) {
		return messages.resolveShareCard(viewer.getId(), type, id);
	}

	private List<ChatRoomRepositoryCustom.OfferRow> offers(User recruiter) {
		return rooms.recruitingOffers(recruiter.getId());
	}

	private int sentSince(User recruiter, Instant start) {
		return rooms.countRecruitingOffersSince(recruiter.getId(), start);
	}

	private ChatRoomRepositoryCustom.OfferMessage firstMessage(User recruiter, long roomId) {
		return rooms.firstOfferMessage(recruiter.getId(), roomId);
	}

	// ---- fixtures --------------------------------------------------------------------

	private User user(String prefix) {
		return users.saveAndFlush(User.create(prefix + "-" + System.nanoTime(), UserType.DEVELOPER));
	}

	private User recruiter(String prefix) {
		return users.saveAndFlush(User.create(prefix + "-" + System.nanoTime(), UserType.RECRUITER));
	}

	private User named(String prefix, String displayName) {
		User user = user(prefix);
		user.changeDisplayName(displayName);
		return users.saveAndFlush(user);
	}

	private ChatRoom direct(User requester, User recipient, DmStatus status, RequestKind kind) {
		ChatRoom room = rooms.saveAndFlush(ChatRoom.direct(
				requester.getId(), recipient.getId(), status, kind, T0.plus(30, ChronoUnit.DAYS)));
		members.saveAndFlush(ChatRoomMember.join(room, requester.getId()));
		members.saveAndFlush(ChatRoomMember.join(room, recipient.getId()));
		return room;
	}

	private void stampRoom(ChatRoom room, Instant createdAt) {
		jdbc.update("update chat_rooms set created_at = ? where id = ?", Timestamp.from(createdAt), room.getId());
	}

	private long message(ChatRoom room, User sender, String body, Instant createdAt) {
		ChatMessage saved = messages.saveAndFlush(ChatMessage.text(room, sender.getId(), body));
		jdbc.update("update chat_messages set created_at = ? where id = ?", Timestamp.from(createdAt), saved.getId());
		return saved.getId();
	}

	private long file(User uploader, String url) {
		return jdbc.queryForObject("""
				insert into uploaded_files(uploader_id, storage_key, url, content_type, byte_size, created_at, updated_at)
				values (?, ?, ?, 'image/png', 1, now(), now()) returning id
				""", Long.class, uploader.getId(), "k-" + System.nanoTime(), url);
	}

	private void image(long messageId, long fileId, int sort) {
		image(messageId, "chat_message_images", "message_id", fileId, sort);
	}

	private void image(long ownerId, String table, String column, long fileId, int sort) {
		jdbc.update("insert into " + table + "(" + column + ", file_id, sort_order, created_at, updated_at) values (?, ?, ?, now(), now())",
				ownerId, fileId, sort);
	}

	private long repo() {
		long githubId = System.nanoTime();
		return jdbc.queryForObject("""
				insert into github_repos(github_repo_id, owner_login, name, full_name, created_at, updated_at)
				values (?, 'acme', ?, ?, now(), now()) returning id
				""", Long.class, githubId, "r" + githubId, "acme/r" + githubId);
	}

	private long post(User author, long repo, String summary, String visibility, boolean deleted) {
		return jdbc.queryForObject("""
				insert into posts(author_id, repo_id, summary, body, visibility, deleted_at, created_at, updated_at)
				values (?, ?, ?, '본문', ?, ?, now(), now()) returning id
				""", Long.class, author.getId(), repo, summary, visibility, deleted ? Timestamp.from(T0) : null);
	}

	private long recruitPost(User author, String title, String description, String visibility, boolean deleted) {
		return jdbc.queryForObject("""
				insert into recruit_posts(author_id, title, description, work_mode, deadline, status, visibility,
				                          deleted_at, sort_at, created_at, updated_at)
				values (?, ?, ?, 'ONLINE', current_date + 30, 'OPEN', ?, ?, now(), now(), now()) returning id
				""", Long.class, author.getId(), title, description, visibility, deleted ? Timestamp.from(T0) : null);
	}

	private void block(User blocker, User blocked, boolean lifted) {
		jdbc.update("""
				insert into user_blocks(blocker_id, blocked_id, created_at, unblocked_at, updated_at)
				values (?, ?, now(), ?, now())
				""", blocker.getId(), blocked.getId(), lifted ? Timestamp.from(Instant.now()) : null);
	}

	private long tag(String name, int sort) {
		return jdbc.queryForObject("""
				insert into tech_tags(name, category, sort_order, created_at, updated_at)
				values (?, 'LANGUAGE', ?, now(), now()) returning id
				""", Long.class, name, sort);
	}

	private void userTag(User user, long tagId) {
		jdbc.update("insert into user_tech_tags(user_id, tag_id, created_at, updated_at) values (?, ?, now(), now())",
				user.getId(), tagId);
	}
}
