package com.linker.backend;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.HexFormat;
import java.util.Set;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import javax.imageio.ImageIO;

import com.linker.backend.dto.notification.request.CreateNotificationCommand;
import com.linker.backend.service.user.UserNotificationService;
import com.linker.backend.service.recruiter.RecruiterNotificationService;
import com.linker.backend.service.admin.AdminNotificationService;
import com.linker.backend.entity.notification.Notification;
import com.linker.backend.entity.account.User;
import com.linker.backend.entity.account.UserStatus;
import com.linker.backend.entity.account.UserType;
import com.linker.backend.entity.github.GithubWebhookDelivery;
import com.linker.backend.entity.github.WebhookStatus;
import com.linker.backend.entity.moderation.Admin;
import com.linker.backend.entity.moderation.AdminRole;
import com.linker.backend.global.security.DeveloperOnly;
import com.linker.backend.global.security.JwtSessionTokens;
import com.linker.backend.global.security.RsaMaterial;
import com.linker.backend.global.security.SessionClaims;
import com.linker.backend.global.security.TeamRole;
import com.linker.backend.repository.account.UserRepository;
import com.linker.backend.repository.github.GithubWebhookDeliveryRepository;
import com.linker.backend.repository.moderation.AdminRepository;
import com.linker.backend.repository.moderation.ReportCaseRepository;
import com.linker.backend.repository.moderation.UserBlockRepository;
import com.linker.backend.service.PublicAuthService;
import com.linker.backend.integration.github.GithubWebhookHandler;
import com.linker.backend.integration.github.GithubWebhookService;
import com.linker.backend.service.user.UserModerationService;

import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

@SpringBootTest
@org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
@Testcontainers
@Import({FoundationIntegrationTest.SecurityProbeController.class, FoundationIntegrationTest.WebhookTestConfig.class})
class FoundationIntegrationTest {

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

	@Autowired
	private MockMvc mockMvc;
	@Autowired
	private JdbcTemplate jdbc;
	@Autowired
	private StringRedisTemplate redis;
	@Autowired
	private UserRepository users;
	@Autowired
	private PublicAuthService sessions;
	@Autowired
	private JwtSessionTokens tokens;
	@Autowired
	private AdminRepository admins;
	@Autowired
	private UserBlockRepository blocks;
	@Autowired
	private UserModerationService blockService;
	@Autowired
	private ReportCaseRepository reportCases;
	@Autowired
	private GithubWebhookDeliveryRepository deliveries;
	@Autowired
	private GithubWebhookService webhooks;


	@Autowired
	private UserNotificationService userNotifications;
	@Autowired
	private RecruiterNotificationService recruiterNotifications;
	@Autowired
	private AdminNotificationService adminNotifications;
	@Autowired
	private PlatformTransactionManager transactionManager;

	enum NotificationProducer { USER, RECRUITER, ADMIN }

	private Notification createNotification(NotificationProducer role, long recipientId, long actorId) {
		CreateNotificationCommand command = new CreateNotificationCommand(
				recipientId, "TEAM_INVITE", actorId, "TEAM", 7L, "/invite/demo", "{\"source\":\"integration\"}", "team:7");
		return switch (role) {
			case USER -> userNotifications.create(command);
			case RECRUITER -> recruiterNotifications.create(command);
			case ADMIN -> adminNotifications.create(command);
		};
	}

	@BeforeEach
	void clean() {
		jdbc.execute("""
				TRUNCATE TABLE
				  reports,
				  report_cases,
				  user_blocks,
				  notifications,
				  uploaded_files,
				  user_sessions,
				  github_tokens,
				  auth_identities,
				  admins,
				  github_webhook_deliveries,
				  users
				RESTART IDENTITY CASCADE
				""");
		Set<String> rateKeys = redis.keys("rate:public:*");
		if (rateKeys != null && !rateKeys.isEmpty()) {
			redis.delete(rateKeys);
		}
		redis.delete("linker:github:webhook");
	}


	@ParameterizedTest
	@EnumSource(NotificationProducer.class)
	void roleNotificationServicesPersistIntoTheSameSchema(NotificationProducer role) {
		User recipient = saveUser("recipient", UserType.RECRUITER);
		User actor = saveUser("actor", UserType.DEVELOPER);
		Notification saved = createNotification(role, recipient.getId(), actor.getId());
		assertThat(saved.getId()).isNotNull();
		assertThat(jdbc.queryForObject("SELECT count(*) FROM notifications", Long.class)).isEqualTo(1L);
		assertThat(jdbc.queryForObject("SELECT user_id FROM notifications WHERE id=?", Long.class, saved.getId()))
				.isEqualTo(recipient.getId());
		assertThat(jdbc.queryForObject("SELECT actor_id FROM notifications WHERE id=?", Long.class, saved.getId()))
				.isEqualTo(actor.getId());
		assertThat(jdbc.queryForObject("SELECT payload ->> 'source' FROM notifications WHERE id=?", String.class, saved.getId()))
				.isEqualTo("integration");
	}

	@ParameterizedTest
	@EnumSource(NotificationProducer.class)
	void notificationRollsBackWithTheProducingUseCase(NotificationProducer role) {
		User recipient = saveUser("recipient", UserType.DEVELOPER);
		User actor = saveUser("actor", UserType.DEVELOPER);
		new TransactionTemplate(transactionManager).executeWithoutResult(status -> {
			createNotification(role, recipient.getId(), actor.getId());
			assertThat(jdbc.queryForObject("SELECT count(*) FROM notifications", Long.class)).isEqualTo(1L);
			status.setRollbackOnly();
		});
		assertThat(jdbc.queryForObject("SELECT count(*) FROM notifications", Long.class)).isZero();
	}

	@Test
	void sessionShowsTheMemberAndRefreshExtendsTheCookie() throws Exception {
		User user = saveUser("octocat", UserType.DEVELOPER);
		user.changeDisplayName("옥토");
		admins.save(Admin.assign(user, AdminRole.OPERATOR));
		String token = sessions.issue(user, "JUnit", "127.0.0.1").rawToken();
		SessionClaims claims = tokens.verify(token).orElseThrow();
		assertThat(claims.subject()).isEqualTo(Long.toString(user.getId()));
		assertThat(claims.memberType()).isEqualTo("DEVELOPER");
		assertThat(claims.operator()).isTrue();
		assertThat(claims.onboarded()).isFalse();
		assertThat(claims.status()).isEqualTo("ACTIVE");

		mockMvc.perform(get("/api/v1/user/me"))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.code").value("LOGIN_REQUIRED"));

		mockMvc.perform(get("/api/v1/user/me").cookie(cookie(token)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.userId").value(user.getId()))
				.andExpect(jsonPath("$.login").value("octocat"))
				.andExpect(jsonPath("$.userType").value("DEVELOPER"))
				.andExpect(jsonPath("$.isAdmin").value(true))
				.andExpect(jsonPath("$.status").value("ACTIVE"))
				.andExpect(jsonPath("$.onboarded").value(false))
				.andExpect(jsonPath("$.suspendedUntil").value(org.hamcrest.Matchers.nullValue()));

		MvcResult refreshed = mockMvc.perform(post("/api/v1/public/auth/refresh").cookie(cookie(token)))
				.andExpect(status().isNoContent())
				.andExpect(header().exists("Set-Cookie"))
				.andReturn();
		String renewed = cookieValue(refreshed.getResponse().getHeader("Set-Cookie"));
		assertThat(renewed).isNotEqualTo(token);
		mockMvc.perform(get("/api/v1/user/me").cookie(cookie(renewed)))
				.andExpect(status().isOk());
		mockMvc.perform(get("/api/v1/user/me").cookie(cookie(token)))
				.andExpect(status().isUnauthorized());

		mockMvc.perform(post("/api/v1/public/auth/refresh"))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.code").value("LOGIN_REQUIRED"));
	}

	@Test
	void operatorApiStaysClosedUntilTheSessionIsOtpVerified() throws Exception {
		User user = saveUser("ops", UserType.DEVELOPER);
		admins.save(Admin.assign(user, AdminRole.OPERATOR));
		PublicAuthService.IssuedSession issued = sessions.issue(user, "JUnit", "127.0.0.1");

		mockMvc.perform(get("/api/v1/admin/report-cases").cookie(cookie(issued.rawToken())))
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.code").value("FORBIDDEN"));

		sessions.markOperatorVerified(issued.sessionId(), Instant.now());

		mockMvc.perform(get("/api/v1/admin/report-cases").cookie(cookie(issued.rawToken())))
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.code").value("NOT_FOUND"));
	}

	@Test
	void developerOnlyAndTeamRoleAreEnforcedOnTheServer() throws Exception {
		User developer = saveUser("dev", UserType.DEVELOPER);
		User recruiter = saveUser("recruiter", UserType.RECRUITER);
		String developerToken = sessions.issue(developer, "JUnit", "127.0.0.1").rawToken();
		String recruiterToken = sessions.issue(recruiter, "JUnit", "127.0.0.1").rawToken();
		assertThat(tokens.verify(recruiterToken).orElseThrow().memberType()).isEqualTo("RECRUITER");

		String forged = tokens.sign(
				new SessionClaims(Long.toString(developer.getId()), "RECRUITER", false, false, "ACTIVE"),
				java.time.Instant.now().plusSeconds(60)
		);
		mockMvc.perform(get("/api/v1/recruiter/offers").cookie(cookie(forged)))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.code").value("LOGIN_REQUIRED"));

		mockMvc.perform(post("/api/v1/user/security-probes/developer").cookie(cookie(recruiterToken)))
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.code").value("DEVELOPER_ONLY"));
		mockMvc.perform(post("/api/v1/user/security-probes/developer").cookie(cookie(developerToken)))
				.andExpect(status().isOk());
		mockMvc.perform(post("/api/v1/user/security-probes/teams/9").cookie(cookie(developerToken)))
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.code").value("TEAM_ROLE_REQUIRED"));
		mockMvc.perform(get("/api/v1/recruiter/offers").cookie(cookie(developerToken)))
				.andExpect(status().isForbidden());
		mockMvc.perform(get("/api/v1/recruiter/offers").cookie(cookie(recruiterToken)))
				.andExpect(status().isNotFound());
	}

	@Test
	void suspendedAccountCanReadButCannotWrite() throws Exception {
		User user = saveUser("paused", UserType.DEVELOPER);
		user.suspendUntil(Instant.now().plusSeconds(3600));
		users.save(user);
		User other = saveUser("other", UserType.DEVELOPER);
		String token = sessions.issue(user, "JUnit", "127.0.0.1").rawToken();

		mockMvc.perform(get("/api/v1/user/me").cookie(cookie(token)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.status").value("SUSPENDED"));
		mockMvc.perform(post("/api/v1/user/blocks")
						.cookie(cookie(token))
						.contentType(MediaType.APPLICATION_JSON)
						.content("{\"userId\":" + other.getId() + "}"))
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.code").value("SUSPENDED"));
	}

	@Test
	void suspensionRewritesTheSessionJwt() throws Exception {
		User user = saveUser("later-paused", UserType.DEVELOPER);
		String token = sessions.issue(user, "JUnit", "127.0.0.1").rawToken();
		user.suspendUntil(Instant.now().plusSeconds(3600));
		users.saveAndFlush(user);

		MvcResult result = mockMvc.perform(get("/api/v1/user/me").cookie(cookie(token)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.status").value("SUSPENDED"))
				.andExpect(header().exists("Set-Cookie"))
				.andReturn();
		String renewed = cookieValue(result.getResponse().getHeader("Set-Cookie"));
		assertThat(tokens.verify(renewed).orElseThrow().status()).isEqualTo("SUSPENDED");
		mockMvc.perform(get("/api/v1/user/me").cookie(cookie(token)))
				.andExpect(status().isUnauthorized());
		mockMvc.perform(post("/api/v1/user/blocks")
						.cookie(cookie(renewed))
						.contentType(MediaType.APPLICATION_JSON)
						.content("{\"userId\":1}"))
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.code").value("SUSPENDED"));
	}

	@Test
	void listsTechTagsAndJobCategories() throws Exception {
		mockMvc.perform(get("/api/v1/public/tech-tags"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.length()").value(28))
				.andExpect(jsonPath("$[0].name").value("TypeScript"));
		mockMvc.perform(get("/api/v1/public/job-categories"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.length()").value(10))
				.andExpect(jsonPath("$[0].key").value("FRONTEND"))
				.andExpect(jsonPath("$[0].label").value("프론트엔드"));
	}

	@Test
	void uploadChecksTypeSizeOwnershipAndCompletion() throws Exception {
		User owner = saveUser("owner", UserType.DEVELOPER);
		User stranger = saveUser("stranger", UserType.DEVELOPER);
		String ownerToken = sessions.issue(owner, "JUnit", "127.0.0.1").rawToken();
		String strangerToken = sessions.issue(stranger, "JUnit", "127.0.0.1").rawToken();
		byte[] png = png(3000, 10);

		mockMvc.perform(post("/api/v1/user/uploads")
						.cookie(cookie(ownerToken))
						.contentType(MediaType.APPLICATION_JSON)
						.content("{\"type\":\"IMAGE\",\"contentType\":\"text/plain\",\"size\":10}"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));

		mockMvc.perform(post("/api/v1/user/uploads")
						.cookie(cookie(ownerToken))
						.contentType(MediaType.APPLICATION_JSON)
						.content("{\"type\":\"IMAGE\",\"contentType\":\"image/png\",\"size\":" + (10 * 1024 * 1024 + 1) + "}"))
				.andExpect(status().isBadRequest());

		String created = mockMvc.perform(post("/api/v1/user/uploads")
						.cookie(cookie(ownerToken))
						.contentType(MediaType.APPLICATION_JSON)
						.content("{\"type\":\"IMAGE\",\"contentType\":\"image/png\",\"size\":" + png.length + "}"))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.uploadUrl").exists())
				.andReturn().getResponse().getContentAsString();
		String fileId = created.replaceAll(".*\"fileId\"\\s*:\\s*\"(\\d+)\".*", "$1");
		String uploadUrl = created.replaceAll(".*\"uploadUrl\"\\s*:\\s*\"([^\"]+)\".*", "$1");
		assertThat(uploadUrl).isEqualTo("/api/v1/user/uploads/" + fileId + "/content");

		mockMvc.perform(post("/api/v1/user/uploads/" + fileId + "/complete").cookie(cookie(ownerToken)))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.code").value("STATE_CONFLICT"));

		mockMvc.perform(put(uploadUrl)
						.cookie(cookie(strangerToken))
						.contentType(MediaType.IMAGE_PNG)
						.content(png))
				.andExpect(status().isNotFound());
		mockMvc.perform(put(uploadUrl)
						.cookie(cookie(ownerToken))
						.contentType(MediaType.IMAGE_PNG)
						.content(png))
				.andExpect(status().isNoContent());
		mockMvc.perform(post("/api/v1/user/uploads/" + fileId + "/complete").cookie(cookie(strangerToken)))
				.andExpect(status().isNotFound());
		String completed = mockMvc.perform(post("/api/v1/user/uploads/" + fileId + "/complete").cookie(cookie(ownerToken)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.fileId").value(fileId))
				.andReturn().getResponse().getContentAsString();
		assertThat(completed.replaceAll(".*\"url\"\\s*:\\s*\"([^\"]+)\".*", "$1"))
				.startsWith("local://uploads/" + owner.getId() + "/");
	}

	@Test
	void blockIsIdempotentAndKeepsClosedPeriods() throws Exception {
		User blocker = saveUser("blocker", UserType.DEVELOPER);
		blocker.changeDisplayName("차단한사람");
		users.save(blocker);
		User blocked = saveUser("blocked", UserType.DEVELOPER);
		blocked.changeDisplayName("차단됨");
		users.save(blocked);
		String token = sessions.issue(blocker, "JUnit", "127.0.0.1").rawToken();

		mockMvc.perform(post("/api/v1/user/blocks")
						.cookie(cookie(token))
						.contentType(MediaType.APPLICATION_JSON)
						.content("{\"userId\":" + blocker.getId() + "}"))
				.andExpect(status().isBadRequest());
		mockMvc.perform(post("/api/v1/user/blocks")
						.cookie(cookie(token))
						.contentType(MediaType.APPLICATION_JSON)
						.content("{\"userId\":99999}"))
				.andExpect(status().isNotFound());

		String body = "{\"userId\":" + blocked.getId() + "}";
		mockMvc.perform(post("/api/v1/user/blocks").cookie(cookie(token)).contentType(MediaType.APPLICATION_JSON).content(body))
				.andExpect(status().isNoContent());
		mockMvc.perform(post("/api/v1/user/blocks").cookie(cookie(token)).contentType(MediaType.APPLICATION_JSON).content(body))
				.andExpect(status().isNoContent());
		assertThat(blocks.count()).isEqualTo(1);

		mockMvc.perform(get("/api/v1/user/me/blocks").cookie(cookie(token)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.length()").value(1))
				.andExpect(jsonPath("$[0].user.login").value("blocked"))
				.andExpect(jsonPath("$[0].user.name").value("차단됨"));

		mockMvc.perform(delete("/api/v1/user/blocks/" + blocked.getId()).cookie(cookie(token)))
				.andExpect(status().isNoContent());
		mockMvc.perform(delete("/api/v1/user/blocks/" + blocked.getId()).cookie(cookie(token)))
				.andExpect(status().isNotFound());
		mockMvc.perform(post("/api/v1/user/blocks").cookie(cookie(token)).contentType(MediaType.APPLICATION_JSON).content(body))
				.andExpect(status().isNoContent());
		assertThat(blocks.count()).isEqualTo(2);
		assertThat(blocks.findByBlockerIdAndBlockedIdAndUnblockedAtIsNull(blocker.getId(), blocked.getId())).isPresent();
	}

	@Test
	void closedBlockPeriodsStillHideDirectMessagesForD() throws Exception {
		User blocker = saveUser("viewer", UserType.DEVELOPER);
		User blocked = saveUser("sender", UserType.DEVELOPER);
		String token = sessions.issue(blocker, "JUnit", "127.0.0.1").rawToken();
		String body = "{\"userId\":" + blocked.getId() + "}";

		mockMvc.perform(post("/api/v1/user/blocks").cookie(cookie(token)).contentType(MediaType.APPLICATION_JSON).content(body))
				.andExpect(status().isNoContent());

		Instant duringBlock = Instant.now();
		assertThat(blockService.hidesDirectMessage(blocker.getId(), blocked.getId(), duringBlock)).isTrue();
		assertThat(blockService.blockedEitherWay(blocker.getId(), blocked.getId())).isTrue();

		mockMvc.perform(delete("/api/v1/user/blocks/" + blocked.getId()).cookie(cookie(token)))
				.andExpect(status().isNoContent());

		Instant afterUnblock = Instant.now().plusSeconds(2);
		assertThat(blockService.hidesDirectMessage(blocker.getId(), blocked.getId(), duringBlock)).isTrue();
		assertThat(blockService.hidesDirectMessage(blocker.getId(), blocked.getId(), afterUnblock)).isFalse();
		assertThat(blockService.blockedEitherWay(blocker.getId(), blocked.getId())).isFalse();
		assertThat(blockService.hidesDirectMessage(blocked.getId(), blocker.getId(), duringBlock)).isFalse();
	}

	@Test
	void reportIsIdempotentAndAutoHidesAtFiveReporters() throws Exception {
		User target = saveUser("target", UserType.DEVELOPER);
		User first = saveUser("reporter", UserType.DEVELOPER);
		String token = sessions.issue(first, "JUnit", "127.0.0.1").rawToken();
		String payload = "{\"targetType\":\"USER\",\"targetId\":\"" + target.getId() + "\",\"reason\":\"SPAM\",\"detail\":\"\"}";

		mockMvc.perform(post("/api/v1/user/reports").cookie(cookie(token)).contentType(MediaType.APPLICATION_JSON).content(payload))
				.andExpect(status().isNoContent());
		mockMvc.perform(post("/api/v1/user/reports").cookie(cookie(token)).contentType(MediaType.APPLICATION_JSON).content(payload))
				.andExpect(status().isNoContent());
		assertThat(reportCases.findAll()).singleElement().satisfies(reportCase -> {
			assertThat(reportCase.getReporterCount()).isEqualTo(1);
			assertThat(reportCase.getAutoHiddenAt()).isNull();
		});

		mockMvc.perform(post("/api/v1/user/reports")
						.cookie(cookie(token))
						.contentType(MediaType.APPLICATION_JSON)
						.content("{\"targetType\":\"USER\",\"targetId\":" + target.getId() + ",\"reason\":\"OTHER\",\"detail\":\"\"}"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
		mockMvc.perform(post("/api/v1/user/reports")
						.cookie(cookie(token))
						.contentType(MediaType.APPLICATION_JSON)
						.content("{\"targetType\":\"POST\",\"targetId\":1,\"reason\":\"SPAM\"}"))
				.andExpect(status().isNotFound());

		for (int i = 2; i <= 5; i++) {
			User reporter = saveUser("reporter" + i, UserType.DEVELOPER);
			String reporterToken = sessions.issue(reporter, "JUnit", "127.0.0.1").rawToken();
			mockMvc.perform(post("/api/v1/user/reports")
							.cookie(cookie(reporterToken))
							.contentType(MediaType.APPLICATION_JSON)
							.content(payload))
					.andExpect(status().isNoContent());
		}
		assertThat(reportCases.findAll()).singleElement()
				.satisfies(reportCase -> {
					assertThat(reportCase.getReporterCount()).isEqualTo(5);
					assertThat(reportCase.getAutoHiddenAt()).isNotNull();
				});
	}

	@Test
	void webhookVerifiesSignatureAndDoesNotProcessADeliveryTwice() throws Exception {
		byte[] body = "{\"action\":\"opened\",\"installation\":{\"id\":42}}".getBytes(StandardCharsets.UTF_8);
		String signature = "sha256=" + sign(body);

		mockMvc.perform(post("/api/v1/webhook/github")
						.header("X-GitHub-Delivery", "delivery-1")
						.header("X-GitHub-Event", "issues")
						.header("X-Hub-Signature-256", "sha256=" + "00".repeat(32))
						.contentType(MediaType.APPLICATION_JSON)
						.content(body))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
		assertThat(deliveries.count()).isZero();

		mockMvc.perform(post("/api/v1/webhook/github")
						.header("X-GitHub-Delivery", "delivery-1")
						.header("X-GitHub-Event", "issues")
						.header("X-Hub-Signature-256", signature)
						.contentType(MediaType.APPLICATION_JSON)
						.content(body))
				.andExpect(status().isAccepted());
		mockMvc.perform(post("/api/v1/webhook/github")
						.header("X-GitHub-Delivery", "delivery-1")
						.header("X-GitHub-Event", "issues")
						.header("X-Hub-Signature-256", signature)
						.contentType(MediaType.APPLICATION_JSON)
						.content(body))
				.andExpect(status().isOk());
		assertThat(deliveries.count()).isEqualTo(1);
		GithubWebhookDelivery saved = deliveries.findByDeliveryId("delivery-1").orElseThrow();
		assertThat(saved.getAction()).isEqualTo("opened");
		assertThat(saved.getInstallationId()).isEqualTo(42L);
		assertThat(saved.getStatus()).isEqualTo(WebhookStatus.RECEIVED);
		assertThat(saved.getPayload()).doesNotContain("test-webhook-secret");

		Long queued = Long.valueOf(redis.opsForList().leftPop("linker:github:webhook"));
		webhooks.dispatch(queued);
		assertThat(deliveries.findByDeliveryId("delivery-1").orElseThrow().getStatus()).isEqualTo(WebhookStatus.RECEIVED);
		redis.delete("linker:github:webhook");

		byte[] handled = "{\"action\":\"ping\"}".getBytes(StandardCharsets.UTF_8);
		mockMvc.perform(post("/api/v1/webhook/github")
						.header("X-GitHub-Delivery", "delivery-2")
						.header("X-GitHub-Event", "test_event")
						.header("X-Hub-Signature-256", "sha256=" + sign(handled))
						.contentType(MediaType.APPLICATION_JSON)
						.content(handled))
				.andExpect(status().isAccepted());
		Long handledId = Long.valueOf(redis.opsForList().leftPop("linker:github:webhook"));
		webhooks.dispatch(handledId);
		assertThat(deliveries.findByDeliveryId("delivery-2").orElseThrow().getStatus()).isEqualTo(WebhookStatus.PROCESSED);
	}

	@Test
	void sitemapListsOnlyPublicDeveloperProfiles() throws Exception {
		User developer = saveUser("ada", UserType.DEVELOPER);
		saveUser("recruiter", UserType.RECRUITER);
		User suspended = saveUser("suspended", UserType.DEVELOPER);
		suspended.suspendUntil(null);
		users.save(suspended);
		User withdrawing = saveUser("leaving", UserType.DEVELOPER);
		withdrawing.markWithdrawing(Instant.now());
		users.save(withdrawing);

		mockMvc.perform(get("/api/v1/public/sitemap/users"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.kind").value("users"))
				.andExpect(jsonPath("$.items.length()").value(1))
				.andExpect(jsonPath("$.items[0].id").value(developer.getId()))
				.andExpect(jsonPath("$.items[0].url").value("/u/ada"));
		mockMvc.perform(get("/api/v1/public/sitemap/posts"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.items.length()").value(0));
		mockMvc.perform(get("/api/v1/public/sitemap/nope"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
	}

	@Test
	void blockListOmitsADeletedUser() throws Exception {
		User blocker = saveUser("keeper", UserType.DEVELOPER);
		User blocked = saveUser("gone", UserType.DEVELOPER);
		String token = sessions.issue(blocker, "JUnit", "127.0.0.1").rawToken();
		mockMvc.perform(post("/api/v1/user/blocks")
						.cookie(cookie(token))
						.contentType(MediaType.APPLICATION_JSON)
						.content("{\"userId\":" + blocked.getId() + "}"))
				.andExpect(status().isNoContent());
		blocked.markDeleted(Instant.now());
		users.save(blocked);

		mockMvc.perform(get("/api/v1/user/me/blocks").cookie(cookie(token)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.length()").value(0));
	}

	@Test
	void publicReadsAreLimitedPerAddressAndIgnoreForwardedFor() throws Exception {
		for (int i = 0; i < 60; i++) {
			mockMvc.perform(get("/api/v1/public/tech-tags")).andExpect(status().isOk());
		}
		mockMvc.perform(get("/api/v1/public/tech-tags").header("X-Forwarded-For", "203.0.113.8"))
				.andExpect(status().isTooManyRequests())
				.andExpect(header().exists("Retry-After"))
				.andExpect(jsonPath("$.code").value("RATE_LIMITED"));
	}

	@Test
	void unknownFailuresDoNotEchoTheException() throws Exception {
		mockMvc.perform(get("/api/v1/public/missing"))
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.code").value("NOT_FOUND"))
				.andExpect(jsonPath("$.message").value("대상을 찾을 수 없어요"));
	}

	private User saveUser(String username, UserType type) {
		return users.saveAndFlush(User.create(username, type));
	}

	private Cookie cookie(String token) {
		return new Cookie("linker_session", token);
	}

	private static String cookieValue(String setCookie) {
		String prefix = "linker_session=";
		int start = setCookie.indexOf(prefix);
		int end = setCookie.indexOf(';', start);
		return setCookie.substring(start + prefix.length(), end < 0 ? setCookie.length() : end);
	}

	private byte[] png(int width, int height) throws Exception {
		BufferedImage image = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
		ByteArrayOutputStream output = new ByteArrayOutputStream();
		ImageIO.write(image, "png", output);
		return output.toByteArray();
	}

	private String sign(byte[] body) throws Exception {
		Mac mac = Mac.getInstance("HmacSHA256");
		mac.init(new SecretKeySpec("test-webhook-secret".getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
		return HexFormat.of().formatHex(mac.doFinal(body));
	}

	@RestController
	static class SecurityProbeController {

		@PostMapping("/api/v1/user/security-probes/developer")
		@DeveloperOnly
		public void developerOnly() {
		}

		@PostMapping("/api/v1/user/security-probes/teams/{teamId}")
		@TeamRole(TeamRole.Level.MEMBER)
		public void team(@PathVariable long teamId) {
		}
	}

	@TestConfiguration
	static class WebhookTestConfig {

		@Bean
		GithubWebhookHandler testEventHandler() {
			return new GithubWebhookHandler() {
				@Override
				public boolean supports(String event) {
					return "test_event".equals(event);
				}

				@Override
				public void handle(GithubWebhookDelivery delivery) {
				}
			};
		}
	}
}
