package com.linker.backend.global.realtime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.lang.reflect.Type;
import java.time.Instant;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

import com.linker.backend.entity.account.User;
import com.linker.backend.entity.account.type.UserType;
import com.linker.backend.entity.chat.ChatRoom;
import com.linker.backend.entity.chat.ChatRoomMember;
import com.linker.backend.entity.chat.type.DmStatus;
import com.linker.backend.entity.chat.type.RequestKind;
import com.linker.backend.global.security.RsaMaterial;
import com.linker.backend.repository.account.UserRepository;
import com.linker.backend.repository.chat.ChatRoomMemberRepository;
import com.linker.backend.repository.chat.ChatRoomRepository;
import com.linker.backend.service.AuthService;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.http.HttpHeaders;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompFrameHandler;
import org.springframework.messaging.simp.stomp.StompHeaders;
import org.springframework.messaging.simp.stomp.StompSession;
import org.springframework.messaging.simp.stomp.StompSessionHandlerAdapter;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.web.socket.WebSocketHttpHeaders;
import org.springframework.web.socket.client.standard.StandardWebSocketClient;
import org.springframework.web.socket.messaging.WebSocketStompClient;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

/**
 * Real WebSocket upgrade against the embedded server. Interceptor unit tests stay separate.
 * Text persistence and catch-up live in ChatTextIntegrationTest.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Testcontainers
class StompConnectionTest {

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
	private UserRepository users;

	@Autowired
	private AuthService sessions;

	@Autowired
	private ChatRoomRepository rooms;

	@Autowired
	private ChatRoomMemberRepository members;

	private String token;
	private User user;

	@BeforeEach
	void issueSession() {
		user = users.saveAndFlush(User.create("stomp-" + System.nanoTime(), UserType.DEVELOPER));
		token = sessions.issue(user, "JUnit", "127.0.0.1").rawToken();
	}

	@Test
	void guestHandshakeIsRejected() {
		assertThatThrownBy(() -> connect(null))
				.isInstanceOf(ExecutionException.class);
	}

	@Test
	void suspendedHandshakeIsRejected() {
		User user = users.saveAndFlush(User.create("suspended-" + System.nanoTime(), UserType.DEVELOPER));
		String suspendedToken = sessions.issue(user, "JUnit", "127.0.0.1").rawToken();
		user.suspendUntil(Instant.now().plusSeconds(3600));
		users.saveAndFlush(user);

		assertThatThrownBy(() -> connect(suspendedToken))
				.isInstanceOf(ExecutionException.class);
	}

	@Test
	void sessionCookieConnectsAndPersonalQueuesSubscribe() throws Exception {
		StompSession session = connect(token);
		assertThat(session.isConnected()).isTrue();
		session.subscribe("/user/queue/notifications", ignoreFrames());
		session.subscribe("/user/queue/chat-rooms", ignoreFrames());
		assertThat(session.isConnected()).isTrue();
		session.subscribe("/topic/chat-rooms/1", ignoreFrames());
		Thread.sleep(300);
		assertThat(session.isConnected()).isFalse();
	}

	@Test
	void reconnectSubscribesAgainWithoutRestoringMessages() throws Exception {
		StompSession first = connect(token);
		first.subscribe("/user/queue/notifications", ignoreFrames());
		first.disconnect();

		StompSession second = connect(token);
		second.subscribe("/user/queue/notifications", ignoreFrames());
		assertThat(second.isConnected()).isTrue();
		second.disconnect();
	}

	@Test
	void activeMemberCanSubscribeToTheRoom() throws Exception {
		User other = users.saveAndFlush(User.create("stomp-other-" + System.nanoTime(), UserType.DEVELOPER));
		ChatRoom room = rooms.saveAndFlush(ChatRoom.direct(
				user.getId(),
				other.getId(),
				DmStatus.ACCEPTED,
				RequestKind.GENERAL,
				null
		));
		members.saveAndFlush(ChatRoomMember.join(room, user.getId()));
		StompSession session = connect(token);
		session.subscribe("/topic/chat-rooms/" + room.getId(), ignoreFrames());
		Thread.sleep(300);
		assertThat(session.isConnected()).isTrue();
		session.disconnect();
	}

	@Test
	void disallowedDestinationIsRejected() throws Exception {
		StompSession session = connect(token);
		AtomicReference<Throwable> error = new AtomicReference<>();
		session.subscribe("/topic/secret", new StompFrameHandler() {
			@Override
			public Type getPayloadType(StompHeaders headers) {
				return String.class;
			}

			@Override
			public void handleFrame(StompHeaders headers, Object payload) {
				error.set(new IllegalStateException(String.valueOf(payload)));
			}
		});
		Thread.sleep(300);
		assertThat(session.isConnected()).isFalse();
		assertThat(error.get()).isNull();
	}

	private StompSession connect(String rawToken) throws Exception {
		WebSocketStompClient client = new WebSocketStompClient(new StandardWebSocketClient());
		WebSocketHttpHeaders handshake = new WebSocketHttpHeaders();
		if (rawToken != null) {
			handshake.add(HttpHeaders.COOKIE, "linker_session=" + rawToken);
		}
		return client.connectAsync(url(), handshake, new StompSessionHandlerAdapter() {
			@Override
			public void handleException(StompSession session, StompCommand command, StompHeaders headers, byte[] payload, Throwable exception) {
			}

			@Override
			public void handleTransportError(StompSession session, Throwable exception) {
			}
		}).get(5, TimeUnit.SECONDS);
	}

	private String url() {
		return "ws://127.0.0.1:" + port + "/ws";
	}

	private static StompFrameHandler ignoreFrames() {
		return new StompFrameHandler() {
			@Override
			public Type getPayloadType(StompHeaders headers) {
				return String.class;
			}

			@Override
			public void handleFrame(StompHeaders headers, Object payload) {
			}
		};
	}
}
