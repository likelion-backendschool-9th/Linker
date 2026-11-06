package com.linker.backend;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.reset;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.lang.reflect.Type;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import com.linker.backend.dto.chat.request.EditChatMessageRequest;
import com.linker.backend.entity.account.User;
import com.linker.backend.entity.account.UserType;
import com.linker.backend.entity.chat.ChatMessage;
import com.linker.backend.entity.chat.ChatRoom;
import com.linker.backend.entity.chat.ChatRoomMember;
import com.linker.backend.entity.chat.DmStatus;
import com.linker.backend.entity.chat.RequestKind;
import com.linker.backend.entity.file.UploadPurpose;
import com.linker.backend.entity.file.UploadedFile;
import com.linker.backend.global.config.PlanLimits;
import com.linker.backend.global.realtime.StompAuthException;
import com.linker.backend.global.security.AuthenticatedUser;
import com.linker.backend.global.security.RsaMaterial;
import com.linker.backend.repository.account.UserRepository;
import com.linker.backend.repository.chat.ChatMessageRepository;
import com.linker.backend.repository.chat.ChatRoomMemberRepository;
import com.linker.backend.repository.chat.ChatRoomRepository;
import com.linker.backend.repository.file.UploadedFileRepository;
import com.linker.backend.service.PublicAuthService;
import com.linker.backend.service.user.UserChatService;
import com.linker.backend.service.user.UserModerationService;

import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.messaging.converter.JacksonJsonMessageConverter;
import org.springframework.messaging.simp.stomp.StompFrameHandler;
import org.springframework.messaging.simp.stomp.StompHeaders;
import org.springframework.messaging.simp.stomp.StompSession;
import org.springframework.messaging.simp.stomp.StompSessionHandlerAdapter;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.socket.WebSocketHttpHeaders;
import org.springframework.web.socket.client.standard.StandardWebSocketClient;
import org.springframework.web.socket.messaging.WebSocketStompClient;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
@Testcontainers
class ChatDirectImageIntegrationTest {

	private static final String CLIENT_URL = "https://client.invalid/not-stored.png";
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

	@LocalServerPort
	private int port;
	@Autowired
	private MockMvc mockMvc;
	@Autowired
	private JdbcTemplate jdbc;
	@Autowired
	private UserRepository users;
	@Autowired
	private PublicAuthService sessions;
	@Autowired
	private ChatRoomRepository rooms;
	@Autowired
	private ChatRoomMemberRepository members;
	@Autowired
	private UploadedFileRepository files;
	@MockitoSpyBean
	private ChatMessageRepository messages;
	@Autowired
	private UserChatService chat;
	@Autowired
	private UserModerationService moderation;
	@Autowired
	private PlatformTransactionManager transactions;

	@Test
	void directSendKeepsServerUrlsInOrder() throws Exception {
		User sender = user("images");
		User reader = user("images-reader");
		ChatRoom room = direct(sender, reader);
		List<String> urls = new ArrayList<>();
		List<Long> ids = new ArrayList<>();
		for (int index = 0; index < PlanLimits.CHAT_IMAGES_PER_SEND; index++) {
			String url = "local://chat/ordered-" + index + "-" + UUID.randomUUID();
			urls.add(url);
			ids.add(ready(sender, UploadPurpose.CHAT, url).getId());
		}
		StompSession senderSocket = connect(sender);
		StompSession readerSocket = connect(reader);
		List<String> live = frames(readerSocket, "/topic/chat-rooms/" + room.getId());
		String clientId = UUID.randomUUID().toString();
		send(senderSocket, room.getId(), clientId, "본문과 사진", ids, Map.of(
				"messageType", "IMAGE",
				"imageUrls", List.of(CLIENT_URL),
				"url", CLIENT_URL
		));
		waitUntil(() -> live.stream().anyMatch(frame -> frame.contains(urls.get(0)) && frame.contains("본문과 사진")));
		assertThat(live).hasSize(1);
		assertOrder(live.get(0), urls);
		assertThat(live.get(0)).doesNotContain(CLIENT_URL).contains("type=TEXT");
		String history = history(reader, room.getId());
		assertThat(history).contains("본문과 사진");
		assertOrder(history, urls);
		assertThat(history).doesNotContain(CLIENT_URL);
		assertThat(linkedFileIds(room.getId(), clientId)).containsExactlyElementsOf(ids);

		UploadedFile single = ready(sender, UploadPurpose.CHAT, "local://chat/only-" + UUID.randomUUID());
		String imageOnly = UUID.randomUUID().toString();
		chat.sendMessage(sender.getId(), room.getId(), Map.of(
				"clientMessageId", imageOnly,
				"text", "   ",
				"fileIds", List.of(String.valueOf(single.getId()))
		));
		mockMvc.perform(get("/api/v1/user/chat-rooms/" + room.getId() + "/messages").cookie(cookie(reader)))
				.andExpect(jsonPath("$.items[1].type").value("IMAGE"))
				.andExpect(jsonPath("$.items[1].text").value(""))
				.andExpect(jsonPath("$.items[1].imageUrls[0]").value(single.getUrl()));

		String textOnly = UUID.randomUUID().toString();
		chat.sendMessage(sender.getId(), room.getId(), Map.of(
				"clientMessageId", textOnly,
				"text", "글만",
				"fileIds", List.of()
		));
		mockMvc.perform(get("/api/v1/user/chat-rooms/" + room.getId() + "/messages").cookie(cookie(reader)))
				.andExpect(jsonPath("$.items[2].type").value("TEXT"))
				.andExpect(jsonPath("$.items[2].text").value("글만"))
				.andExpect(jsonPath("$.items[2].imageUrls").isEmpty());

		mockMvc.perform(post("/api/v1/user/chat-rooms/" + room.getId() + "/read")
						.contentType(MediaType.APPLICATION_JSON)
						.content("{\"lastReadMessageId\":" + messageId(imageOnly) + "}")
						.cookie(cookie(reader)))
				.andExpect(status().isNoContent());
		senderSocket.disconnect();
		readerSocket.disconnect();
	}

	@Test
	void oneImageAndEmptyFileIdsStayOnTheExistingTextPath() throws Exception {
		User sender = user("one");
		User reader = user("one-reader");
		ChatRoom room = direct(sender, reader);
		UploadedFile file = ready(sender, UploadPurpose.CHAT, "local://chat/one-" + UUID.randomUUID());
		String clientId = UUID.randomUUID().toString();
		chat.sendMessage(sender.getId(), room.getId(), Map.of(
				"clientMessageId", clientId,
				"fileIds", List.of(file.getId().intValue())
		));
		mockMvc.perform(get("/api/v1/user/chat-rooms/" + room.getId() + "/messages").cookie(cookie(sender)))
				.andExpect(jsonPath("$.items[0].type").value("IMAGE"))
				.andExpect(jsonPath("$.items[0].text").value(""))
				.andExpect(jsonPath("$.items[0].imageUrls[0]").value(file.getUrl()))
				.andExpect(jsonPath("$.items[0].payload").value(nullValue()));
		mockMvc.perform(get("/api/v1/user/chat-rooms").param("tab", "DIRECT").cookie(cookie(reader)))
				.andExpect(jsonPath("$.items[0].lastMessage.text").value(""))
				.andExpect(jsonPath("$.items[0].lastMessage.text").value(org.hamcrest.Matchers.not("사진을 보냈어요")));
	}

	@Test
	void invalidAttachmentsAreNotStored() throws Exception {
		User sender = user("bad-file");
		User other = user("bad-other");
		ChatRoom room = direct(sender, other);
		List<Long> tooMany = new ArrayList<>();
		for (int index = 0; index < PlanLimits.CHAT_IMAGES_PER_SEND + 1; index++) {
			tooMany.add(ready(sender, UploadPurpose.CHAT, "local://chat/many-" + index + "-" + UUID.randomUUID()).getId());
		}
		assertThatThrownBy(() -> chat.sendMessage(sender.getId(), room.getId(), payload("열한장", tooMany)))
				.isInstanceOf(StompAuthException.class);
		UploadedFile one = ready(sender, UploadPurpose.CHAT, "local://chat/dup-" + UUID.randomUUID());
		assertThatThrownBy(() -> chat.sendMessage(sender.getId(), room.getId(), payload("중복", List.of(one.getId(), one.getId()))))
				.isInstanceOf(StompAuthException.class);
		assertThatThrownBy(() -> chat.sendMessage(sender.getId(), room.getId(), Map.of(
				"clientMessageId", UUID.randomUUID().toString(),
				"text", "멘션",
				"fileIds", List.of(one.getId()),
				"mentionedUserIds", List.of(other.getId())
		))).isInstanceOf(StompAuthException.class);
		assertThatThrownBy(() -> chat.sendMessage(sender.getId(), room.getId(), Map.of(
				"clientMessageId", UUID.randomUUID().toString(),
				"text", "",
				"fileIds", List.of()
		))).isInstanceOf(StompAuthException.class);

		StompSession socket = connect(sender);
		List<String> rejected = frames(socket, "/user/queue/chat-rooms");
		UploadedFile pending = UploadedFile.pending(sender.getId(), UploadPurpose.CHAT, "uploads/" + UUID.randomUUID(), "image/png", 8);
		files.saveAndFlush(pending);
		chat.sendMessage(sender.getId(), room.getId(), payload("미완료", List.of(pending.getId())));
		UploadedFile foreign = ready(other, UploadPurpose.CHAT, "local://chat/foreign-" + UUID.randomUUID());
		chat.sendMessage(sender.getId(), room.getId(), payload("타인", List.of(foreign.getId())));
		UploadedFile post = ready(sender, UploadPurpose.POST, "local://chat/post-" + UUID.randomUUID());
		chat.sendMessage(sender.getId(), room.getId(), payload("다른용도", List.of(post.getId())));
		UploadedFile missingPurpose = ready(sender, null, "local://chat/none-" + UUID.randomUUID());
		chat.sendMessage(sender.getId(), room.getId(), payload("용도없음", List.of(missingPurpose.getId())));
		waitUntil(() -> rejected.stream().filter(frame -> frame.contains("CHAT_SEND_REJECTED")).count() >= 4);
		assertThat(rejected.stream().anyMatch(frame -> frame.contains("STATE_CONFLICT"))).isTrue();
		assertThat(rejected.stream().anyMatch(frame -> frame.contains("NOT_FOUND"))).isTrue();
		assertThat(rejected.stream().filter(frame -> frame.contains("VALIDATION_ERROR")).count()).isGreaterThanOrEqualTo(2);
		assertThat(jdbc.queryForObject("select count(*) from chat_messages where room_id = ?", Long.class, room.getId())).isZero();
		assertThat(jdbc.queryForObject(
				"""
				select count(*) from chat_message_images i
				join chat_messages m on m.id = i.message_id
				where m.room_id = ?
				""",
				Long.class,
				room.getId()
		)).isZero();
		socket.disconnect();
	}

	@Test
	void sameClientIdKeepsImagesAndADifferentSetConflicts() throws Exception {
		User sender = user("retry-image");
		User other = user("retry-image-other");
		ChatRoom room = direct(sender, other);
		UploadedFile first = ready(sender, UploadPurpose.CHAT, "local://chat/retry-a-" + UUID.randomUUID());
		UploadedFile second = ready(sender, UploadPurpose.CHAT, "local://chat/retry-b-" + UUID.randomUUID());
		String clientId = UUID.randomUUID().toString();
		List<Long> ids = List.of(first.getId(), second.getId());
		StompSession senderSocket = connect(sender);
		StompSession otherSocket = connect(other);
		List<String> topic = frames(otherSocket, "/topic/chat-rooms/" + room.getId());
		chat.sendMessage(sender.getId(), room.getId(), payload(clientId, "같은", ids));
		waitUntil(() -> topic.size() == 1);
		List<String> accepted = frames(senderSocket, "/user/queue/chat-rooms");
		chat.sendMessage(sender.getId(), room.getId(), payload(clientId, "같은", ids));
		waitUntil(() -> accepted.stream().anyMatch(frame -> frame.contains("CHAT_SEND_ACCEPTED") && frame.contains(clientId)));
		assertThat(topic).hasSize(1);
		assertThat(messageCount(sender.getId(), clientId)).isEqualTo(1L);
		assertThat(linkedFileIds(room.getId(), clientId)).containsExactly(first.getId(), second.getId());

		chat.sendMessage(sender.getId(), room.getId(), payload(clientId, "다른 본문", ids));
		chat.sendMessage(sender.getId(), room.getId(), payload(clientId, "같은", List.of(second.getId(), first.getId())));
		chat.sendMessage(sender.getId(), room.getId(), payload(clientId, "", List.of(first.getId())));
		waitUntil(() -> accepted.stream().filter(frame -> frame.contains("CONFLICT") && frame.contains(clientId)).count() >= 3);
		assertThat(topic).hasSize(1);
		assertThat(linkedFileIds(room.getId(), clientId)).containsExactly(first.getId(), second.getId());
		assertThat(jdbc.queryForObject(
				"select body from chat_messages where sender_id = ? and client_message_id = ?",
				String.class,
				sender.getId(),
				clientId
		)).isEqualTo("같은");

		ChatMessage stored = messages.findBySenderIdAndClientMessageId(sender.getId(), clientId).orElseThrow();
		AtomicInteger finds = new AtomicInteger();
		doAnswer(invocation -> finds.getAndIncrement() == 0 ? Optional.empty() : Optional.of(stored))
				.when(messages).findBySenderIdAndClientMessageId(sender.getId(), clientId);
		doThrow(new DataIntegrityViolationException("duplicate"))
				.when(messages).saveAndFlush(any(ChatMessage.class));
		try {
			chat.sendMessage(sender.getId(), room.getId(), payload(clientId, "같은", ids));
			waitUntil(() -> accepted.stream().filter(frame -> frame.contains("CHAT_SEND_ACCEPTED") && frame.contains(clientId)).count() >= 2);
			Thread.sleep(300);
			assertThat(topic).hasSize(1);
			assertThat(linkedFileIds(room.getId(), clientId)).containsExactly(first.getId(), second.getId());
		}
		finally {
			reset(messages);
		}
		senderSocket.disconnect();
		otherSocket.disconnect();
	}

	@Test
	void concurrentRetryKeepsOneImageRow() throws Exception {
		User sender = user("race-image");
		User other = user("race-image-other");
		ChatRoom room = direct(sender, other);
		UploadedFile first = ready(sender, UploadPurpose.CHAT, "local://chat/race-a-" + UUID.randomUUID());
		UploadedFile second = ready(sender, UploadPurpose.CHAT, "local://chat/race-b-" + UUID.randomUUID());
		String clientId = UUID.randomUUID().toString();
		StompSession senderSocket = connect(sender);
		StompSession otherSocket = connect(other);
		List<String> topic = frames(otherSocket, "/topic/chat-rooms/" + room.getId());
		List<String> accepted = frames(senderSocket, "/user/queue/chat-rooms");
		ExecutorService pool = Executors.newFixedThreadPool(2);
		CountDownLatch start = new CountDownLatch(1);
		Future<?> left = pool.submit(() -> sendWhen(start, sender, room.getId(), clientId, "동시", List.of(first.getId(), second.getId())));
		Future<?> right = pool.submit(() -> sendWhen(start, sender, room.getId(), clientId, "동시", List.of(first.getId(), second.getId())));
		start.countDown();
		left.get(10, TimeUnit.SECONDS);
		right.get(10, TimeUnit.SECONDS);
		pool.shutdown();
		waitUntil(() -> topic.size() == 1 && accepted.stream().anyMatch(frame -> frame.contains("CHAT_SEND_ACCEPTED")));
		Thread.sleep(300);
		assertThat(topic).hasSize(1);
		assertThat(messageCount(sender.getId(), clientId)).isEqualTo(1L);
		assertThat(linkedFileIds(room.getId(), clientId)).containsExactly(first.getId(), second.getId());
		assertOrder(topic.get(0), List.of(first.getUrl(), second.getUrl()));

		String clash = UUID.randomUUID().toString();
		UploadedFile otherFile = ready(sender, UploadPurpose.CHAT, "local://chat/race-c-" + UUID.randomUUID());
		ExecutorService clashPool = Executors.newFixedThreadPool(2);
		CountDownLatch clashStart = new CountDownLatch(1);
		Future<?> keep = clashPool.submit(() -> sendWhen(clashStart, sender, room.getId(), clash, "가", List.of(first.getId())));
		Future<?> drop = clashPool.submit(() -> sendWhen(clashStart, sender, room.getId(), clash, "나", List.of(otherFile.getId())));
		clashStart.countDown();
		keep.get(10, TimeUnit.SECONDS);
		drop.get(10, TimeUnit.SECONDS);
		clashPool.shutdown();
		waitUntil(() -> accepted.stream().anyMatch(frame -> frame.contains("CONFLICT") && frame.contains(clash)));
		Thread.sleep(300);
		assertThat(messageCount(sender.getId(), clash)).isEqualTo(1L);
		List<Long> stored = linkedFileIds(room.getId(), clash);
		assertThat(stored).hasSize(1);
		assertThat(List.of(first.getId(), otherFile.getId())).contains(stored.get(0));
		String body = jdbc.queryForObject(
				"select body from chat_messages where sender_id = ? and client_message_id = ?",
				String.class,
				sender.getId(),
				clash
		);
		if (stored.get(0).equals(first.getId())) {
			assertThat(body).isEqualTo("가");
			assertThat(history(other, room.getId())).contains(first.getUrl()).doesNotContain(otherFile.getUrl());
		}
		else {
			assertThat(body).isEqualTo("나");
			assertThat(history(other, room.getId())).contains(otherFile.getUrl());
		}
		senderSocket.disconnect();
		otherSocket.disconnect();
	}

	@Test
	void teamRoomWithoutReadableTeamStateDoesNotStoreImages() throws Exception {
		User member = user("team-image");
		ChatRoom team = rooms.saveAndFlush(ChatRoom.team(null));
		members.saveAndFlush(ChatRoomMember.join(team, member.getId()));
		UploadedFile file = ready(member, UploadPurpose.CHAT, "local://chat/team-" + UUID.randomUUID());
		StompSession socket = connect(member);
		List<String> rejected = frames(socket, "/user/queue/chat-rooms");
		send(socket, team.getId(), UUID.randomUUID().toString(), "팀 사진", List.of(file.getId()), Map.of());
		waitUntil(() -> rejected.stream().anyMatch(frame -> frame.contains("FORBIDDEN") && frame.contains("retryable=false")));
		assertThat(jdbc.queryForObject("select count(*) from chat_messages where room_id = ?", Long.class, team.getId())).isZero();
		assertThat(jdbc.queryForObject(
				"select count(*) from chat_message_images where file_id = ?",
				Long.class,
				file.getId()
		)).isZero();
		socket.disconnect();
	}

	@Test
	void editKeepsFilesAndDeleteHideBlockDropUrls() throws Exception {
		User author = user("edit-image");
		User reader = user("edit-image-reader");
		ChatRoom room = direct(author, reader);
		UploadedFile first = ready(author, UploadPurpose.CHAT, "local://chat/edit-a-" + UUID.randomUUID());
		UploadedFile second = ready(author, UploadPurpose.CHAT, "local://chat/edit-b-" + UUID.randomUUID());
		String withText = UUID.randomUUID().toString();
		chat.sendMessage(author.getId(), room.getId(), payload(withText, "고치기 전", List.of(first.getId(), second.getId())));
		long messageId = messageId(withText);
		String edited = mockMvc.perform(patch("/api/v1/user/chat-rooms/" + room.getId() + "/messages/" + messageId)
						.contentType(MediaType.APPLICATION_JSON)
						.content("{\"text\":\"고친 본문\"}")
						.cookie(cookie(author)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.text").value("고친 본문"))
				.andExpect(jsonPath("$.type").value("TEXT"))
				.andExpect(jsonPath("$.imageUrls[0]").value(first.getUrl()))
				.andExpect(jsonPath("$.imageUrls[1]").value(second.getUrl()))
				.andReturn().getResponse().getContentAsString();
		assertThat(edited).doesNotContain(CLIENT_URL);
		assertThat(linkedFileIds(room.getId(), withText)).containsExactly(first.getId(), second.getId());
		StompSession readerSocket = connect(reader);
		List<String> topic = frames(readerSocket, "/topic/chat-rooms/" + room.getId());
		chat.edit(principal(author), room.getId(), messageId, new EditChatMessageRequest("다시 고침"));
		waitUntil(() -> topic.stream().anyMatch(frame -> frame.contains("event=EDIT") && frame.contains(first.getUrl())));
		assertThat(topic.get(0)).contains(second.getUrl()).contains("다시 고침");

		String imageOnly = UUID.randomUUID().toString();
		UploadedFile only = ready(author, UploadPurpose.CHAT, "local://chat/edit-only-" + UUID.randomUUID());
		chat.sendMessage(author.getId(), room.getId(), payload(imageOnly, "", List.of(only.getId())));
		long imageId = messageId(imageOnly);
		mockMvc.perform(patch("/api/v1/user/chat-rooms/" + room.getId() + "/messages/" + imageId)
						.contentType(MediaType.APPLICATION_JSON)
						.content("{\"text\":\"이미지 수정\"}")
						.cookie(cookie(author)))
				.andExpect(status().isForbidden());
		assertThat(jdbc.queryForObject("select body from chat_messages where id = ?", String.class, imageId)).isEmpty();
		assertThat(linkedFileIds(room.getId(), imageOnly)).containsExactly(only.getId());

		String later = UUID.randomUUID().toString();
		chat.sendMessage(author.getId(), room.getId(), Map.of("clientMessageId", later, "text", "이후"));
		assertThat(history(reader, room.getId())).contains("다시 고침");
		assertThat(history(reader, room.getId(), messageId(later))).doesNotContain("다시 고침");

		mockMvc.perform(delete("/api/v1/user/chat-rooms/" + room.getId() + "/messages/" + imageId).cookie(cookie(author)))
				.andExpect(status().isNoContent());
		waitUntil(() -> topic.stream().anyMatch(frame -> frame.contains("event=DELETE") && frame.contains("삭제된 메시지입니다")));
		assertThat(topic.stream().filter(frame -> frame.contains("event=DELETE")).noneMatch(frame -> frame.contains(only.getUrl()))).isTrue();
		assertThat(history(reader, room.getId())).contains("삭제된 메시지입니다").doesNotContain(only.getUrl());
		assertThat(linkedFileIds(room.getId(), imageOnly)).containsExactly(only.getId());

		ChatMessage hidden = messages.findBySenderIdAndClientMessageId(author.getId(), withText).orElseThrow();
		hidden.hide();
		messages.saveAndFlush(hidden);
		String hiddenPage = history(reader, room.getId());
		assertThat(hiddenPage).contains("운영 정책에 따라 숨겨진 메시지예요").doesNotContain(first.getUrl()).doesNotContain(second.getUrl());

		User blockedSender = user("blocked-image");
		ChatRoom blockedRoom = direct(blockedSender, reader);
		UploadedFile secret = ready(blockedSender, UploadPurpose.CHAT, "local://chat/blocked-" + UUID.randomUUID());
		String hiddenId = UUID.randomUUID().toString();
		moderation.block(reader.getId(), blockedSender.getId());
		List<String> hiddenLive = frames(readerSocket, "/topic/chat-rooms/" + blockedRoom.getId());
		chat.sendMessage(blockedSender.getId(), blockedRoom.getId(), payload(hiddenId, "가려진 사진", List.of(secret.getId())));
		Thread.sleep(500);
		assertThat(hiddenLive).isEmpty();
		assertThat(history(reader, blockedRoom.getId())).doesNotContain(secret.getUrl());
		assertThat(chat.currentTranscript(reader.getId(), blockedRoom.getId(), messageId(hiddenId))).isNull();
		assertThat(chat.currentTranscript(blockedSender.getId(), blockedRoom.getId(), messageId(hiddenId)).imageUrls())
				.containsExactly(secret.getUrl());

		User withdrawn = user("left-service");
		ChatRoom leftRoom = direct(withdrawn, reader);
		UploadedFile kept = ready(withdrawn, UploadPurpose.CHAT, "local://chat/withdrawn-" + UUID.randomUUID());
		chat.sendMessage(withdrawn.getId(), leftRoom.getId(), payload("탈퇴 전", List.of(kept.getId())));
		Cookie withdrawnCookie = cookie(withdrawn);
		withdrawn.markDeleted(java.time.Instant.now());
		users.saveAndFlush(withdrawn);
		mockMvc.perform(get("/api/v1/user/chat-rooms/" + leftRoom.getId() + "/messages").cookie(withdrawnCookie))
				.andExpect(status().isUnauthorized());
		mockMvc.perform(get("/api/v1/user/chat-rooms/" + leftRoom.getId() + "/messages").cookie(cookie(reader)))
				.andExpect(jsonPath("$.items[0].sender.name").value("탈퇴한 사용자"))
				.andExpect(jsonPath("$.items[0].imageUrls[0]").value(kept.getUrl()));
		readerSocket.disconnect();
	}

	@Test
	void rollbackDropsTheImageLink() {
		User sender = user("rollback-image");
		User other = user("rollback-image-other");
		ChatRoom room = direct(sender, other);
		UploadedFile file = ready(sender, UploadPurpose.CHAT, "local://chat/rollback-" + UUID.randomUUID());
		new TransactionTemplate(transactions).executeWithoutResult(status -> {
			chat.sendMessage(sender.getId(), room.getId(), payload("롤백 사진", List.of(file.getId())));
			status.setRollbackOnly();
		});
		assertThat(jdbc.queryForObject("select count(*) from chat_messages where room_id = ?", Long.class, room.getId())).isZero();
		assertThat(jdbc.queryForObject(
				"select count(*) from chat_message_images where file_id = ?",
				Long.class,
				file.getId()
		)).isZero();
	}

	private void sendWhen(CountDownLatch start, User sender, long roomId, String clientId, String text, List<Long> fileIds) {
		try {
			start.await();
			chat.sendMessage(sender.getId(), roomId, payload(clientId, text, fileIds));
		}
		catch (InterruptedException exception) {
			Thread.currentThread().interrupt();
		}
	}

	private Map<String, Object> payload(String text, List<?> fileIds) {
		return payload(UUID.randomUUID().toString(), text, fileIds);
	}

	private Map<String, Object> payload(String clientId, String text, List<?> fileIds) {
		Map<String, Object> body = new HashMap<>();
		body.put("clientMessageId", clientId);
		body.put("text", text);
		body.put("fileIds", fileIds);
		return body;
	}

	private void send(
			StompSession session,
			long roomId,
			String clientId,
			String text,
			List<?> fileIds,
			Map<String, Object> extra
	) {
		Map<String, Object> body = payload(clientId, text, fileIds);
		body.putAll(extra);
		StompHeaders headers = new StompHeaders();
		headers.setDestination("/app/chat-rooms/" + roomId + "/messages");
		session.send(headers, body);
	}

	private List<Long> linkedFileIds(long roomId, String clientId) {
		return jdbc.queryForList(
				"""
				select i.file_id
				from chat_message_images i
				join chat_messages m on m.id = i.message_id
				where m.room_id = ? and m.client_message_id = ?
				order by i.sort_order
				""",
				Long.class,
				roomId,
				clientId
		);
	}

	private long messageId(String clientIdOrBody) {
		Long byClient = jdbc.query(
				"select id from chat_messages where client_message_id = ?",
				(rs, row) -> rs.getLong("id"),
				clientIdOrBody
		).stream().findFirst().orElse(null);
		if (byClient != null) {
			return byClient;
		}
		return jdbc.queryForObject("select id from chat_messages where body = ?", Long.class, clientIdOrBody);
	}

	private long messageCount(long senderId, String clientId) {
		return jdbc.queryForObject(
				"select count(*) from chat_messages where sender_id = ? and client_message_id = ?",
				Long.class,
				senderId,
				clientId
		);
	}

	private static void assertOrder(String body, List<String> urls) {
		int previous = -1;
		for (String url : urls) {
			int at = body.indexOf(url);
			assertThat(at).isGreaterThan(previous);
			previous = at;
		}
	}

	private UploadedFile ready(User owner, UploadPurpose purpose, String url) {
		UploadedFile file = UploadedFile.pending(
				owner.getId(),
				purpose == null ? UploadPurpose.CHAT : purpose,
				"uploads/" + UUID.randomUUID(),
				"image/png",
				8
		);
		file.complete(url, "image/png", 8, 2, 2);
		UploadedFile saved = files.saveAndFlush(file);
		if (purpose == null) {
			jdbc.update("update uploaded_files set purpose = null where id = ?", saved.getId());
		}
		return saved;
	}

	private List<String> frames(StompSession session, String destination) throws InterruptedException {
		List<String> frames = new CopyOnWriteArrayList<>();
		session.subscribe(destination, new StompFrameHandler() {
			@Override
			public Type getPayloadType(StompHeaders headers) {
				return Map.class;
			}

			@Override
			public void handleFrame(StompHeaders headers, Object payload) {
				frames.add(String.valueOf(payload));
			}
		});
		Thread.sleep(300);
		return frames;
	}

	private StompSession connect(User user) throws Exception {
		WebSocketStompClient client = new WebSocketStompClient(new StandardWebSocketClient());
		client.setMessageConverter(new JacksonJsonMessageConverter());
		WebSocketHttpHeaders handshake = new WebSocketHttpHeaders();
		handshake.add(HttpHeaders.COOKIE, "linker_session=" + sessions.issue(user, "JUnit", "127.0.0.1").rawToken());
		return client.connectAsync("ws://127.0.0.1:" + port + "/ws", handshake, new StompSessionHandlerAdapter() {
		}).get(5, TimeUnit.SECONDS);
	}

	private void waitUntil(java.util.function.BooleanSupplier condition) throws InterruptedException {
		long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(5);
		while (System.nanoTime() < deadline) {
			if (condition.getAsBoolean()) {
				return;
			}
			Thread.sleep(50);
		}
		throw new AssertionError("timed out waiting for a chat frame");
	}

	private String history(User user, long roomId) throws Exception {
		return history(user, roomId, null);
	}

	private String history(User user, long roomId, Long after) throws Exception {
		var request = get("/api/v1/user/chat-rooms/" + roomId + "/messages").cookie(cookie(user));
		if (after != null) {
			request.param("after", after.toString());
		}
		return mockMvc.perform(request).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
	}

	private User user(String prefix) {
		return users.saveAndFlush(User.create(prefix + "-" + System.nanoTime(), UserType.DEVELOPER));
	}

	private ChatRoom direct(User requester, User recipient) {
		ChatRoom room = rooms.saveAndFlush(ChatRoom.direct(
				requester.getId(),
				recipient.getId(),
				DmStatus.ACCEPTED,
				RequestKind.GENERAL,
				null
		));
		members.saveAndFlush(ChatRoomMember.join(room, requester.getId()));
		members.saveAndFlush(ChatRoomMember.join(room, recipient.getId()));
		return room;
	}

	private Cookie cookie(User user) {
		return new Cookie("linker_session", sessions.issue(user, "JUnit", "127.0.0.1").rawToken());
	}

	private AuthenticatedUser principal(User user) {
		return new AuthenticatedUser(user.getId(), user.getUsername(), user.getUserType(), user.getStatus(), null, false, false, false, 1L);
	}
}
