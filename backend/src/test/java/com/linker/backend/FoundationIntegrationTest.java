package com.linker.backend;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.TemporalAdjusters;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Set;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import javax.imageio.ImageIO;

import com.linker.backend.dto.notification.request.CreateNotificationCommand;
import com.linker.backend.service.admin.NotificationService;
import com.linker.backend.entity.notification.Notification;
import com.linker.backend.entity.account.AuthIdentity;
import com.linker.backend.entity.account.User;
import com.linker.backend.entity.account.type.UserStatus;
import com.linker.backend.entity.account.type.UserType;
import com.linker.backend.entity.profile.ProfileVisit;
import com.linker.backend.entity.github.GithubWebhookDelivery;
import com.linker.backend.entity.github.type.WebhookStatus;
import com.linker.backend.entity.moderation.Admin;
import com.linker.backend.entity.moderation.type.AdminRole;
import com.linker.backend.global.config.PlanLimits;
import com.linker.backend.global.security.DeveloperOnly;
import com.linker.backend.global.security.JwtSessionTokens;
import com.linker.backend.global.security.RsaMaterial;
import com.linker.backend.global.security.SessionClaims;
import com.linker.backend.global.security.TeamRole;
import com.linker.backend.repository.account.AuthIdentityRepository;
import com.linker.backend.repository.account.UserRepository;
import com.linker.backend.repository.profile.ProfileVisitRepository;
import com.linker.backend.repository.github.GithubWebhookDeliveryRepository;
import com.linker.backend.repository.moderation.AdminRepository;
import com.linker.backend.repository.moderation.ReportCaseRepository;
import com.linker.backend.repository.moderation.UserBlockRepository;
import com.linker.backend.service.AuthService;
import com.linker.backend.service.admin.TotpCodes;
import com.linker.backend.integration.github.GithubTokenCipher;
import com.linker.backend.integration.mail.SmtpMailGateway;
import com.linker.backend.integration.github.GithubWebhookHandler;
import com.linker.backend.integration.github.GithubWebhookService;
import com.linker.backend.service.user.ModerationService;
import com.linker.backend.async.schedule.RecruiterViewNoticeSchedule;

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
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.jdbc.core.JdbcTemplate;
import org.mockito.ArgumentCaptor;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
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
	private static final String ENCRYPTION_KEY = Base64.getEncoder().encodeToString(new byte[] {
			7, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
			0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1
	});

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
		registry.add("linker.github.app.token-encryption-key", () -> ENCRYPTION_KEY);
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
	private AuthIdentityRepository identities;
	@Autowired
	private PasswordEncoder passwords;
	@Autowired
	private ProfileVisitRepository visits;
	@Autowired
	private RecruiterViewNoticeSchedule recruiterViewNotices;
	@Autowired
	private AuthService sessions;
	@Autowired
	private JwtSessionTokens tokens;
	@Autowired
	private AdminRepository admins;
	@Autowired
	private UserBlockRepository blocks;
	@Autowired
	private ModerationService blockService;
	@Autowired
	private ReportCaseRepository reportCases;
	@Autowired
	private GithubWebhookDeliveryRepository deliveries;
	@Autowired
	private GithubWebhookService webhooks;
	@Autowired
	private GithubTokenCipher otpSecrets;


	@Autowired
	private com.linker.backend.service.user.NotificationService userNotifications;
	@Autowired
	private com.linker.backend.service.recruiter.NotificationService recruiterNotifications;
	@Autowired
	private NotificationService adminNotifications;
	@Autowired
	private PlatformTransactionManager transactionManager;

	@MockitoBean
	private SmtpMailGateway mail;

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
		AuthService.IssuedSession issued = sessions.issue(user, "JUnit", "127.0.0.1");
		assertThat(tokens.verify(issued.rawToken()).orElseThrow().operator()).isTrue();

		mockMvc.perform(get("/api/v1/admin/report-cases").cookie(cookie(issued.rawToken())))
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.code").value("FORBIDDEN"));
		mockMvc.perform(post("/api/v1/user/security-probes/developer").cookie(cookie(issued.rawToken())))
				.andExpect(status().isOk());
		mockMvc.perform(post("/api/v1/user/security-probes/teams/9").cookie(cookie(issued.rawToken())))
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.code").value("TEAM_ROLE_REQUIRED"));

		User developer = saveUser("plain", UserType.DEVELOPER);
		mockMvc.perform(get("/api/v1/admin/report-cases").cookie(cookie(sessions.issue(developer, "JUnit", "127.0.0.1").rawToken())))
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.code").value("FORBIDDEN"));

		sessions.markOperatorVerified(issued.sessionId(), Instant.now());

		mockMvc.perform(get("/api/v1/admin/report-cases").cookie(cookie(issued.rawToken())))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.items").isArray());

		AuthService.IssuedSession other = sessions.issue(user, "JUnit", "127.0.0.1");
		mockMvc.perform(get("/api/v1/admin/report-cases").cookie(cookie(other.rawToken())))
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.code").value("FORBIDDEN"));
		mockMvc.perform(get("/api/v1/admin/report-cases").cookie(cookie(issued.rawToken())))
				.andExpect(status().isOk());
	}

	@Test
	void operatorOtpVerifyOpensOnlyThatSession() throws Exception {
		User operator = saveUser("otpops", UserType.DEVELOPER);
		Admin admin = admins.save(Admin.assign(operator, AdminRole.OPERATOR));
		AuthService.IssuedSession issued = sessions.issue(operator, "JUnit", "127.0.0.1");
		String body = "{\"code\":\"000000\"}";

		mockMvc.perform(post("/api/v1/admin/otp/verify").contentType(MediaType.APPLICATION_JSON).content(body))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.code").value("LOGIN_REQUIRED"));

		User developer = saveUser("otpplain", UserType.DEVELOPER);
		mockMvc.perform(post("/api/v1/admin/otp/verify")
				.cookie(cookie(sessions.issue(developer, "JUnit", "127.0.0.1").rawToken()))
				.contentType(MediaType.APPLICATION_JSON)
				.content(body))
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.code").value("FORBIDDEN"));

		mockMvc.perform(post("/api/v1/admin/otp/verify")
				.cookie(cookie(issued.rawToken()))
				.contentType(MediaType.APPLICATION_JSON)
				.content(body))
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.code").value("OTP_NOT_ENROLLED"));
		mockMvc.perform(get("/api/v1/admin/report-cases").cookie(cookie(issued.rawToken())))
				.andExpect(status().isForbidden());

		String secret = "JBSWY3DPEHPK3PXP";
		admin.enrollOtp(otpSecrets.encrypt(secret), Instant.now());
		admins.save(admin);
		String code = TotpCodes.code(secret, Instant.now());
		String wrong = code.substring(0, 5) + (code.charAt(5) == '0' ? "1" : "0");
		mockMvc.perform(post("/api/v1/admin/otp/verify")
				.cookie(cookie(issued.rawToken()))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"code\":\"" + wrong + "\"}"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("OTP_INVALID"));
		mockMvc.perform(get("/api/v1/admin/report-cases").cookie(cookie(issued.rawToken())))
				.andExpect(status().isForbidden());

		mockMvc.perform(post("/api/v1/admin/otp/verify")
				.cookie(cookie(issued.rawToken()))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"code\":\"" + code + "\"}"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.verified").value(true));
		mockMvc.perform(get("/api/v1/admin/report-cases").cookie(cookie(issued.rawToken())))
				.andExpect(status().isOk());

		AuthService.IssuedSession other = sessions.issue(operator, "JUnit", "127.0.0.1");
		mockMvc.perform(get("/api/v1/admin/report-cases").cookie(cookie(other.rawToken())))
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.code").value("FORBIDDEN"));

		User paused = saveUser("otppaused", UserType.DEVELOPER);
		paused.suspendUntil(Instant.now().plusSeconds(3600));
		users.save(paused);
		Admin pausedAdmin = admins.save(Admin.assign(paused, AdminRole.OPERATOR));
		pausedAdmin.enrollOtp(otpSecrets.encrypt(secret), Instant.now());
		admins.save(pausedAdmin);
		String pausedToken = sessions.issue(paused, "JUnit", "127.0.0.1").rawToken();
		mockMvc.perform(post("/api/v1/admin/otp/verify")
				.cookie(cookie(pausedToken))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"code\":\"" + TotpCodes.code(secret, Instant.now()) + "\"}"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.verified").value(true));
		mockMvc.perform(get("/api/v1/admin/report-cases").cookie(cookie(pausedToken)))
				.andExpect(status().isOk());
	}

	@Test
	void suspendedOperatorStillNeedsOtpAndARevokedSessionLosesIt() throws Exception {
		User user = saveUser("pausedops", UserType.DEVELOPER);
		admins.save(Admin.assign(user, AdminRole.OPERATOR));
		user.suspendUntil(Instant.now().plusSeconds(3600));
		users.save(user);
		AuthService.IssuedSession issued = sessions.issue(user, "JUnit", "127.0.0.1");

		mockMvc.perform(get("/api/v1/admin/report-cases").cookie(cookie(issued.rawToken())))
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.code").value("FORBIDDEN"));

		sessions.markOperatorVerified(issued.sessionId(), Instant.now());
		mockMvc.perform(get("/api/v1/admin/report-cases").cookie(cookie(issued.rawToken())))
				.andExpect(status().isOk());

		sessions.revoke(issued.rawToken());
		mockMvc.perform(get("/api/v1/admin/report-cases").cookie(cookie(issued.rawToken())))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.code").value("LOGIN_REQUIRED"));
	}

	@Test
	void deletedOperatorCannotKeepTheAdminSession() throws Exception {
		User user = saveUser("goneops", UserType.DEVELOPER);
		admins.save(Admin.assign(user, AdminRole.OPERATOR));
		AuthService.IssuedSession issued = sessions.issue(user, "JUnit", "127.0.0.1");
		sessions.markOperatorVerified(issued.sessionId(), Instant.now());
		user.markDeleted(Instant.now());
		users.save(user);

		mockMvc.perform(get("/api/v1/admin/report-cases").cookie(cookie(issued.rawToken())))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.code").value("LOGIN_REQUIRED"));
	}

	@Test
	void operatorIdleRevokesThatSessionOnly() throws Exception {
		User user = saveUser("idleops", UserType.DEVELOPER);
		admins.save(Admin.assign(user, AdminRole.OPERATOR));
		AuthService.IssuedSession idle = sessions.issue(user, "JUnit", "127.0.0.1");
		AuthService.IssuedSession current = sessions.issue(user, "JUnit", "127.0.0.1");
		sessions.markOperatorVerified(idle.sessionId(), Instant.now());
		sessions.markOperatorVerified(current.sessionId(), Instant.now());
		mockMvc.perform(get("/api/v1/admin/report-cases").cookie(cookie(idle.rawToken())))
				.andExpect(status().isOk());

		jdbc.update("update user_sessions set operator_seen_at = now() - interval '31 minutes' where id = ?", idle.sessionId());

		mockMvc.perform(get("/api/v1/admin/report-cases").cookie(cookie(idle.rawToken())))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.code").value("LOGIN_REQUIRED"));
		mockMvc.perform(get("/api/v1/admin/report-cases").cookie(cookie(current.rawToken())))
				.andExpect(status().isOk());
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
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.items").isEmpty());
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
		User operatorA = saveUser("ops-a", UserType.DEVELOPER);
		User operatorB = saveUser("ops-b", UserType.DEVELOPER);
		User suspendedOps = saveUser("ops-suspended", UserType.DEVELOPER);
		suspendedOps.suspendUntil(Instant.now().plusSeconds(3600));
		users.save(suspendedOps);
		admins.save(Admin.assign(operatorA, AdminRole.OPERATOR));
		admins.save(Admin.assign(operatorB, AdminRole.OPERATOR));
		admins.save(Admin.assign(suspendedOps, AdminRole.OPERATOR));
		admins.save(Admin.assign(target, AdminRole.OPERATOR)); // reported user who is also an operator — excluded

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
		assertThat(jdbc.queryForObject("SELECT count(*) FROM notifications", Long.class)).isZero();

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
					assertThat(jdbc.queryForObject(
							"SELECT count(*) FROM notifications WHERE notification_type=? AND group_key=?",
							Long.class,
							"REPORT_AUTO_HIDDEN",
							"report-auto-hidden:" + reportCase.getId()
					)).isEqualTo(2L);
					assertThat(jdbc.queryForList(
							"SELECT user_id FROM notifications WHERE group_key=?",
							Long.class,
							"report-auto-hidden:" + reportCase.getId()
					)).containsExactlyInAnyOrder(operatorA.getId(), operatorB.getId());
				});

		User sixth = saveUser("reporter6", UserType.DEVELOPER);
		String sixthToken = sessions.issue(sixth, "JUnit", "127.0.0.1").rawToken();
		mockMvc.perform(post("/api/v1/user/reports")
						.cookie(cookie(sixthToken))
						.contentType(MediaType.APPLICATION_JSON)
						.content(payload))
				.andExpect(status().isNoContent());
		assertThat(jdbc.queryForObject(
				"SELECT count(*) FROM notifications WHERE notification_type=?",
				Long.class,
				"REPORT_AUTO_HIDDEN"
		)).isEqualTo(2L);
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
				.andExpect(jsonPath("$.items[0].url").value("/user/ada"));
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
	void openApiPublishesExistingFoundationEndpointsOnly() throws Exception {
		MvcResult result = mockMvc.perform(get("/v3/api-docs"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.paths['/api/v1/user/me'].get.tags[0]").value("p00-common"))
				.andExpect(jsonPath("$.paths['/api/v1/user/me'].get.operationId").value("getMe"))
				.andExpect(jsonPath("$.paths['/api/v1/public/auth/refresh'].post.operationId").value("refreshSession"))
				.andExpect(jsonPath("$.paths['/api/v1/public/auth/refresh'].post.responses['204']").exists())
				.andExpect(jsonPath("$.paths['/api/v1/public/auth/refresh'].post.responses['200']").doesNotExist())
				.andExpect(jsonPath("$.paths['/api/v1/user/uploads'].post.responses['201']").exists())
				.andExpect(jsonPath("$.paths['/api/v1/user/blocks'].post.responses['204']").exists())
				.andExpect(jsonPath("$.paths['/api/v1/webhook/github'].post.responses['202']").exists())
				.andExpect(jsonPath("$.paths['/api/v1/public/tech-tags'].get.operationId").value("listTechTags"))
				.andExpect(jsonPath("$.paths['/api/v1/public/job-categories'].get.operationId").value("listJobCategories"))
				.andExpect(jsonPath("$.paths['/api/v1/public/sitemap/{kind}'].get.operationId").value("listSitemap"))
				.andExpect(jsonPath("$.paths['/api/v1/user/uploads'].post.operationId").value("createUpload"))
				.andExpect(jsonPath("$.paths['/api/v1/user/uploads/{fileId}/complete'].post.operationId").value("completeUpload"))
				.andExpect(jsonPath("$.paths['/api/v1/user/me/blocks'].get.operationId").value("listBlocks"))
				.andExpect(jsonPath("$.paths['/api/v1/user/blocks'].post.operationId").value("createBlock"))
				.andExpect(jsonPath("$.paths['/api/v1/user/blocks/{userId}'].delete.operationId").value("deleteBlock"))
				.andExpect(jsonPath("$.paths['/api/v1/user/reports'].post.operationId").value("createReport"))
				.andExpect(jsonPath("$.paths['/api/v1/user/team-setup/install-url'].get.operationId").value("getInstallUrl"))
				.andExpect(jsonPath("$.paths['/api/v1/user/team-setup/installations/verify'].post.operationId").value("verifyInstallation"))
				.andExpect(jsonPath("$.paths['/api/v1/webhook/github'].post.operationId").value("receiveGithubWebhook"))
				.andExpect(jsonPath("$.paths['/api/v1/admin/otp/verify'].post.operationId").value("verifyAdminOtp"))
				.andExpect(jsonPath("$.paths['/api/v1/admin/otp/verify'].post.tags[0]").value("p25-admin-reports"))
				.andExpect(jsonPath("$.paths['/api/v1/user/me/profile/github-sync'].post.operationId").value("syncMyProfileFromGithub"))
				.andExpect(jsonPath("$.paths['/api/v1/user/me/profile/github-sync'].post.tags[0]").value("p05-profile-edit"))
				.andExpect(jsonPath("$.paths['/api/v1/public/users/{login}/teams'].get.operationId").value("listPublicTeams"))
				.andExpect(jsonPath("$.paths['/api/v1/public/users/{login}/teams'].get.tags[0]").value("p04-profile"))
				.andExpect(jsonPath("$.paths['/api/v1/public/recruiter-signup/email-codes'].post.operationId").value("requestRecruiterEmailCode"))
				.andExpect(jsonPath("$.paths['/api/v1/public/recruiter-auth/login'].post.operationId").value("loginRecruiter"))
				.andExpect(jsonPath("$.paths['/api/v1/recruiter/offers'].get.operationId").value("listRecruiterOffers"))
				.andExpect(jsonPath("$.paths['/api/v1/recruiter/offers/counts'].get.operationId").value("countRecruiterOffers"))
				.andExpect(jsonPath("$.paths['/api/v1/recruiter/offers/summary'].get.operationId").value("summarizeRecruiterOffers"))
				.andExpect(jsonPath("$.paths['/api/v1/recruiter/offers/{roomId}/first-message'].get.operationId").value("getRecruiterOfferFirstMessage"))
				.andExpect(jsonPath("$.paths['/api/v1/public/users/{login}/contributions'].get.operationId").value("listPublicContributions"))
				.andExpect(jsonPath("$.paths['/api/v1/recruiter/me/ad'].get.operationId").value("getMyJobAd"))
				.andExpect(jsonPath("$.paths['/api/v1/recruiter/me/ad'].put.operationId").value("saveMyJobAd"))
				.andExpect(jsonPath("$.paths['/api/v1/recruiter/me/ad/status'].patch.operationId").value("updateMyJobAdStatus"))
				.andReturn();
		String body = result.getResponse().getContentAsString(StandardCharsets.UTF_8);
		assertThat(body).doesNotContain("/uploads/{fileId}/content");
		assertThat(body).doesNotContain("security-probes");
		assertThat(body).doesNotContain("/app/chat-rooms");
		assertThat(body).doesNotContain("/topic/chat-rooms");
		Path output = Path.of("build", "openapi", "v3-api-docs.json");
		Files.createDirectories(output.getParent());
		Files.writeString(output, body);
	}

	@Test
	void onboardingFinishesWithAnOnboardedCookie() throws Exception {
		User user = saveUser("octocat", UserType.DEVELOPER);
		Cookie cookie = cookie(sessions.issue(user, "JUnit", "127.0.0.1").rawToken());

		mockMvc.perform(get("/api/v1/user/onboarding").cookie(cookie))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.step").value("AGREEMENTS"))
				.andExpect(jsonPath("$.emailRequired").value(true))
				.andExpect(jsonPath("$.termsVersion").value("2026-10-01"));

		mockMvc.perform(post("/api/v1/user/onboarding/agreements")
						.cookie(cookie)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{"ageConfirmed":true,"termsAccepted":true,"privacyAccepted":true,"marketingAccepted":false,"termsVersion":"2026-10-01"}
								"""))
				.andExpect(status().isNoContent());

		mockMvc.perform(put("/api/v1/user/onboarding/email")
						.cookie(cookie)
						.contentType(MediaType.APPLICATION_JSON)
						.content("{\"email\":\"me@example.com\"}"))
				.andExpect(status().isNoContent());

		MvcResult saved = mockMvc.perform(put("/api/v1/user/onboarding/profile")
						.cookie(cookie)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{"name":"명석","bio":"","blogUrl":"","techStack":["Java"],"lookingForTeam":false,"jobStatus":"OFF"}
								"""))
				.andExpect(status().isNoContent())
				.andExpect(header().exists("Set-Cookie"))
				.andReturn();

		SessionClaims renewed = tokens.verify(cookieValue(saved.getResponse().getHeader("Set-Cookie"))).orElseThrow();
		assertThat(renewed.onboarded()).isTrue();
		mockMvc.perform(get("/api/v1/user/me").cookie(cookie(cookieValue(saved.getResponse().getHeader("Set-Cookie")))))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.onboarded").value(true));

		mockMvc.perform(get("/api/v1/public/legal-documents/terms"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.effectiveDate").value("2026-10-01"))
				.andExpect(jsonPath("$.body").value(org.hamcrest.Matchers.containsString("# 이용약관")));
		mockMvc.perform(get("/api/v1/public/legal-documents/privacy"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.effectiveDate").value("2026-10-01"))
				.andExpect(jsonPath("$.body").value(org.hamcrest.Matchers.containsString("# 개인정보처리방침")));
		mockMvc.perform(get("/api/v1/public/legal-documents/community"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.effectiveDate").value("2026-10-01"))
				.andExpect(jsonPath("$.body").value(org.hamcrest.Matchers.containsString("# 커뮤니티 정책")));
	}

	@Test
	void publicProfileReadsTeamsAndCompletionWhenThoseTablesExist() throws Exception {
		User user = saveUser("octocat", UserType.DEVELOPER);
		mockMvc.perform(get("/api/v1/public/users/octocat"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.completion.projectCount").value(0))
				.andExpect(jsonPath("$.completion.issueCompletionRate").value(0));
		mockMvc.perform(get("/api/v1/public/users/octocat/teams"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.items").isEmpty());

		jdbc.execute("""
				CREATE TABLE completion_records (
				    id bigint PRIMARY KEY,
				    user_id bigint NOT NULL,
				    result varchar(16) NOT NULL,
				    assigned_issue_count integer NOT NULL,
				    done_issue_count integer NOT NULL
				)
				""");
		try {
			for (String[] fixture : new String[][] {{"Linker", "ACTIVE"}, {"Done", "COMPLETED"},
					{"Paused", "READ_ONLY"}, {"Left", "ACTIVE"}}) {
				long teamId = com.linker.backend.support.TeamTestFixtures.team(jdbc, user.getId(), fixture[0], fixture[1]);
				jdbc.update("""
						INSERT INTO team_members(team_id,user_id,role,github_org_state,joined_at,created_at,updated_at)
						VALUES (?,?,'OWNER','MEMBER',now(),now(),now())
						""", teamId, user.getId());
			}
			jdbc.update("UPDATE teams SET avatar_url='https://avatars.githubusercontent.com/u/1' WHERE name='Linker'");
			jdbc.update("UPDATE team_members SET left_at=now() WHERE team_id=4");
			jdbc.update("INSERT INTO completion_records (id, user_id, result, assigned_issue_count, done_issue_count) VALUES (1, ?, 'COMPLETED', 4, 2)", user.getId());
			jdbc.update("INSERT INTO completion_records (id, user_id, result, assigned_issue_count, done_issue_count) VALUES (2, ?, 'DROPPED', 2, 0)", user.getId());

			mockMvc.perform(get("/api/v1/public/users/octocat"))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.completion.projectCount").value(1))
					.andExpect(jsonPath("$.completion.issueCompletionRate").value(org.hamcrest.Matchers.closeTo(2.0 / 6.0, 0.000001)));
			mockMvc.perform(get("/api/v1/public/users/octocat/teams"))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.items.length()").value(2))
					.andExpect(jsonPath("$.items[0].id").value(1))
					.andExpect(jsonPath("$.items[0].name").value("Linker"))
					.andExpect(jsonPath("$.items[0].orgAvatarUrl").value("https://avatars.githubusercontent.com/u/1"))
					.andExpect(jsonPath("$.items[0].status").value("ACTIVE"))
					.andExpect(jsonPath("$.items[1].status").value("COMPLETED"))
					.andExpect(jsonPath("$.nextCursor").value(org.hamcrest.Matchers.nullValue()));
		}
		finally {
			jdbc.execute("DROP TABLE IF EXISTS completion_records");
		}
	}

	@Test
	void operatorActionChangesExistingContent() throws Exception {
		User operator = saveUser("modops", UserType.DEVELOPER);
		Admin admin = admins.save(Admin.assign(operator, AdminRole.OPERATOR));
		String secret = "JBSWY3DPEHPK3PXP";
		admin.enrollOtp(otpSecrets.encrypt(secret), Instant.now());
		admins.save(admin);
		String token = sessions.issue(operator, "JUnit", "127.0.0.1").rawToken();
		mockMvc.perform(post("/api/v1/admin/otp/verify")
						.cookie(cookie(token))
						.contentType(MediaType.APPLICATION_JSON)
						.content("{\"code\":\"" + TotpCodes.code(secret, Instant.now()) + "\"}"))
				.andExpect(status().isOk());

		User author = saveUser("msgauthor", UserType.DEVELOPER);
		long roomId = jdbc.queryForObject("""
				INSERT INTO chat_rooms (room_type, dm_key, dm_status, requester_id, created_at, updated_at)
				VALUES ('DIRECT', 'mod-room', 'ACCEPTED', ?, now(), now())
				RETURNING id
				""", Long.class, author.getId());
		long messageId = jdbc.queryForObject("""
				INSERT INTO chat_messages (room_id, sender_id, message_type, body, visibility, created_at, updated_at)
				VALUES (?, ?, 'TEXT', 'hello', 'VISIBLE', now(), now())
				RETURNING id
				""", Long.class, roomId, author.getId());
		long caseId = insertCase("TEAM_MESSAGE", messageId, author.getId());

		mockMvc.perform(post("/api/v1/admin/report-cases/" + caseId + "/actions")
						.cookie(cookie(token))
						.contentType(MediaType.APPLICATION_JSON)
						.content("{\"action\":\"HIDE\",\"reason\":\"욕설\"}"))
				.andExpect(status().isOk());
		assertThat(jdbc.queryForObject("SELECT visibility FROM chat_messages WHERE id = ?", String.class, messageId)).isEqualTo("HIDDEN");
		assertThat(jdbc.queryForObject("SELECT deleted_at FROM chat_messages WHERE id = ?", Object.class, messageId)).isNull();

		mockMvc.perform(post("/api/v1/admin/report-cases/" + caseId + "/actions")
						.cookie(cookie(token))
						.contentType(MediaType.APPLICATION_JSON)
						.content("{\"action\":\"RESTORE\"}"))
				.andExpect(status().isOk());
		assertThat(jdbc.queryForObject("SELECT visibility FROM chat_messages WHERE id = ?", String.class, messageId)).isEqualTo("VISIBLE");

		mockMvc.perform(post("/api/v1/admin/report-cases/" + caseId + "/actions")
						.cookie(cookie(token))
						.contentType(MediaType.APPLICATION_JSON)
						.content("{\"action\":\"DELETE\",\"reason\":\"삭제\"}"))
				.andExpect(status().isOk());
		assertThat(jdbc.queryForObject("SELECT visibility FROM chat_messages WHERE id = ?", String.class, messageId)).isEqualTo("HIDDEN");
		assertThat(jdbc.queryForObject("SELECT deleted_at FROM chat_messages WHERE id = ?", Object.class, messageId)).isNotNull();

		mockMvc.perform(post("/api/v1/admin/report-cases/" + caseId + "/actions")
						.cookie(cookie(token))
						.contentType(MediaType.APPLICATION_JSON)
						.content("{\"action\":\"RESTORE\"}"))
				.andExpect(status().isOk());
		assertThat(jdbc.queryForObject("SELECT deleted_at FROM chat_messages WHERE id = ?", Object.class, messageId)).isNull();

		long dismissId = jdbc.queryForObject("""
				INSERT INTO chat_messages (room_id, sender_id, message_type, body, visibility, created_at, updated_at)
				VALUES (?, ?, 'TEXT', 'keep', 'VISIBLE', now(), now())
				RETURNING id
				""", Long.class, roomId, author.getId());
		long dismissed = insertCase("DM_MESSAGE", dismissId, author.getId());
		mockMvc.perform(post("/api/v1/admin/report-cases/" + dismissed + "/actions")
						.cookie(cookie(token))
						.contentType(MediaType.APPLICATION_JSON)
						.content("{\"action\":\"DISMISS\"}"))
				.andExpect(status().isOk());
		assertThat(jdbc.queryForObject("SELECT visibility FROM chat_messages WHERE id = ?", String.class, dismissId)).isEqualTo("VISIBLE");

		long repoId = jdbc.queryForObject("""
				INSERT INTO github_repos (github_repo_id, owner_login, name, full_name, created_at, updated_at)
				VALUES (?, 'mod', 'post', ?, now(), now())
				RETURNING id
				""", Long.class, 900_000L + author.getId(), "mod/post-" + author.getId());
		long postId = jdbc.queryForObject("""
				INSERT INTO posts (author_id, repo_id, summary, body, visibility, created_at, updated_at)
				VALUES (?, ?, '요약', '본문', 'VISIBLE', now(), now())
				RETURNING id
				""", Long.class, author.getId(), repoId);
		long commentId = jdbc.queryForObject("""
				INSERT INTO comments (post_id, author_id, body, visibility, created_at, updated_at)
				VALUES (?, ?, '댓글', 'VISIBLE', now(), now())
				RETURNING id
				""", Long.class, postId, author.getId());
		long adId = jdbc.queryForObject("""
				INSERT INTO recruiter_ads (
				    recruiter_id, job_category, title, url, url_host, closes_on, status, created_at, updated_at)
				VALUES (?, 'BACKEND', '광고', 'https://example.com/job', 'example.com', CURRENT_DATE, 'ACTIVE', now(), now())
				RETURNING id
				""", Long.class, author.getId());
		long recruitId = jdbc.queryForObject("""
				INSERT INTO recruit_posts (
				    author_id, title, description, work_mode, deadline, status, visibility, sort_at, created_at, updated_at)
				VALUES (?, '모집', '설명', 'ONLINE', CURRENT_DATE, 'OPEN', 'VISIBLE', now(), now(), now())
				RETURNING id
				""", Long.class, author.getId());
		try {
			long postCase = insertCase("POST", postId, author.getId());
			Object postUpdatedAt = jdbc.queryForObject("SELECT updated_at FROM posts WHERE id = ?", Object.class, postId);
			mockMvc.perform(post("/api/v1/admin/report-cases/" + postCase + "/actions")
							.cookie(cookie(token))
							.contentType(MediaType.APPLICATION_JSON)
							.content("{\"action\":\"HIDE\",\"reason\":\"숨김\"}"))
					.andExpect(status().isOk());
			assertThat(jdbc.queryForObject("SELECT visibility FROM posts WHERE id = ?", String.class, postId)).isEqualTo("HIDDEN");
			assertThat(jdbc.queryForObject("SELECT deleted_at FROM posts WHERE id = ?", Object.class, postId)).isNull();
			assertThat(jdbc.queryForObject("SELECT updated_at FROM posts WHERE id = ?", Object.class, postId)).isEqualTo(postUpdatedAt);

			long missing = insertCase("POST", postId + 100_000L, author.getId());
			mockMvc.perform(post("/api/v1/admin/report-cases/" + missing + "/actions")
							.cookie(cookie(token))
							.contentType(MediaType.APPLICATION_JSON)
							.content("{\"action\":\"HIDE\",\"reason\":\"없음\"}"))
					.andExpect(status().isNotFound())
					.andExpect(jsonPath("$.code").value("NOT_FOUND"));
			assertThat(jdbc.queryForObject("SELECT status FROM report_cases WHERE id = ?", String.class, missing)).isEqualTo("PENDING");

			long adCase = insertCase("RECRUITER_AD", adId, author.getId());
			Object adUpdatedAt = jdbc.queryForObject("SELECT updated_at FROM recruiter_ads WHERE id = ?", Object.class, adId);
			mockMvc.perform(post("/api/v1/admin/report-cases/" + adCase + "/actions")
							.cookie(cookie(token))
							.contentType(MediaType.APPLICATION_JSON)
							.content("{\"action\":\"DELETE\",\"reason\":\"광고 삭제\"}"))
					.andExpect(status().isOk());
			assertThat(jdbc.queryForObject("SELECT status FROM recruiter_ads WHERE id = ?", String.class, adId)).isEqualTo("HIDDEN");
			assertThat(jdbc.queryForObject("SELECT hidden_at FROM recruiter_ads WHERE id = ?", Object.class, adId)).isNotNull();
			assertThat(jdbc.queryForObject("SELECT deleted_at FROM recruiter_ads WHERE id = ?", Object.class, adId)).isNotNull();
			assertThat(jdbc.queryForObject("SELECT updated_at FROM recruiter_ads WHERE id = ?", Object.class, adId)).isEqualTo(adUpdatedAt);
			assertThat(jdbc.queryForObject("SELECT ended_reason FROM recruiter_ads WHERE id = ?", String.class, adId)).isNull();

			long commentCase = insertCase("COMMENT", commentId, author.getId());
			Object commentUpdatedAt = jdbc.queryForObject("SELECT updated_at FROM comments WHERE id = ?", Object.class, commentId);
			mockMvc.perform(post("/api/v1/admin/report-cases/" + commentCase + "/actions")
							.cookie(cookie(token))
							.contentType(MediaType.APPLICATION_JSON)
							.content("{\"action\":\"HIDE\",\"reason\":\"댓글\"}"))
					.andExpect(status().isOk());
			assertThat(jdbc.queryForObject("SELECT status FROM report_cases WHERE id = ?", String.class, commentCase)).isEqualTo("ACTIONED");
			assertThat(jdbc.queryForObject("SELECT visibility FROM comments WHERE id = ?", String.class, commentId)).isEqualTo("HIDDEN");
			assertThat(jdbc.queryForObject("SELECT deleted_at FROM comments WHERE id = ?", Object.class, commentId)).isNull();
			assertThat(jdbc.queryForObject("SELECT updated_at FROM comments WHERE id = ?", Object.class, commentId)).isEqualTo(commentUpdatedAt);

			long recruitCase = insertCase("RECRUIT_POST", recruitId, author.getId());
			Object recruitUpdatedAt = jdbc.queryForObject("SELECT updated_at FROM recruit_posts WHERE id = ?", Object.class, recruitId);
			mockMvc.perform(post("/api/v1/admin/report-cases/" + recruitCase + "/actions")
							.cookie(cookie(token))
							.contentType(MediaType.APPLICATION_JSON)
							.content("{\"action\":\"HIDE\",\"reason\":\"모집 숨김\"}"))
					.andExpect(status().isOk());
			assertThat(jdbc.queryForObject("SELECT visibility FROM recruit_posts WHERE id = ?", String.class, recruitId)).isEqualTo("HIDDEN");
			assertThat(jdbc.queryForObject("SELECT deleted_at FROM recruit_posts WHERE id = ?", Object.class, recruitId)).isNull();
			assertThat(jdbc.queryForObject("SELECT status FROM recruit_posts WHERE id = ?", String.class, recruitId)).isEqualTo("OPEN");
			mockMvc.perform(post("/api/v1/admin/report-cases/" + recruitCase + "/actions")
							.cookie(cookie(token))
							.contentType(MediaType.APPLICATION_JSON)
							.content("{\"action\":\"RESTORE\"}"))
					.andExpect(status().isOk());
			assertThat(jdbc.queryForObject("SELECT visibility FROM recruit_posts WHERE id = ?", String.class, recruitId)).isEqualTo("VISIBLE");
			mockMvc.perform(post("/api/v1/admin/report-cases/" + recruitCase + "/actions")
							.cookie(cookie(token))
							.contentType(MediaType.APPLICATION_JSON)
							.content("{\"action\":\"DELETE\",\"reason\":\"모집 삭제\"}"))
					.andExpect(status().isOk());
			assertThat(jdbc.queryForObject("SELECT visibility FROM recruit_posts WHERE id = ?", String.class, recruitId)).isEqualTo("HIDDEN");
			assertThat(jdbc.queryForObject("SELECT deleted_at FROM recruit_posts WHERE id = ?", Object.class, recruitId)).isNotNull();
			assertThat(jdbc.queryForObject("SELECT updated_at FROM recruit_posts WHERE id = ?", Object.class, recruitId)).isEqualTo(recruitUpdatedAt);
		}
		finally {
			jdbc.update("DELETE FROM comments WHERE id = ?", commentId);
			jdbc.update("DELETE FROM recruiter_ads WHERE id = ?", adId);
			jdbc.update("DELETE FROM recruit_posts WHERE id = ?", recruitId);
			jdbc.update("DELETE FROM posts WHERE id = ?", postId);
			jdbc.update("DELETE FROM github_repos WHERE id = ?", repoId);
		}
	}

	@Test
	void jobAdReportDetailShowsTheAdAndHideNotifiesTheRecruiter() throws Exception {
		User operator = saveUser("adops", UserType.DEVELOPER);
		Admin admin = admins.save(Admin.assign(operator, AdminRole.OPERATOR));
		String secret = "JBSWY3DPEHPK3PXP";
		admin.enrollOtp(otpSecrets.encrypt(secret), Instant.now());
		admins.save(admin);
		String token = sessions.issue(operator, "JUnit", "127.0.0.1").rawToken();
		mockMvc.perform(post("/api/v1/admin/otp/verify")
						.cookie(cookie(token))
						.contentType(MediaType.APPLICATION_JSON)
						.content("{\"code\":\"" + TotpCodes.code(secret, Instant.now()) + "\"}"))
				.andExpect(status().isOk());

		User recruiter = saveUser("ad-recruiter", UserType.RECRUITER);
		jdbc.update("""
				INSERT INTO recruiter_profiles (
				    user_id, company_name, company_email_domain, job_title, email_verified_at, created_at, updated_at)
				VALUES (?, '넥스트랩', 'nextlab.example', '리크루터', now(), now(), now())
				""", recruiter.getId());
		long adId = jdbc.queryForObject("""
				INSERT INTO recruiter_ads (
				    recruiter_id, job_category, title, url, url_host, closes_on, status, created_at, updated_at)
				VALUES (?, 'BACKEND', '백엔드 개발자', 'https://www.wanted.co.kr/wd/1', 'www.wanted.co.kr', DATE '2026-12-01', 'ACTIVE', now(), now())
				RETURNING id
				""", Long.class, recruiter.getId());
		long caseId = insertCase("RECRUITER_AD", adId, recruiter.getId());

		mockMvc.perform(get("/api/v1/admin/report-cases/" + caseId).cookie(cookie(token)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.targetType").value("RECRUITER_AD"))
				.andExpect(jsonPath("$.targetSummary").value("백엔드 개발자"))
				.andExpect(jsonPath("$.jobAd.company").value("넥스트랩"))
				.andExpect(jsonPath("$.jobAd.title").value("백엔드 개발자"))
				.andExpect(jsonPath("$.jobAd.jobCategory").value("BACKEND"))
				.andExpect(jsonPath("$.jobAd.closesOn").value("2026-12-01"))
				.andExpect(jsonPath("$.jobAd.urlHost").value("www.wanted.co.kr"))
				.andExpect(jsonPath("$.target.userType").value("RECRUITER"));

		mockMvc.perform(post("/api/v1/admin/report-cases/" + caseId + "/actions")
						.cookie(cookie(token))
						.contentType(MediaType.APPLICATION_JSON)
						.content("{\"action\":\"HIDE\",\"reason\":\"허위 광고\"}"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.handledAction").value("HIDE"))
				.andExpect(jsonPath("$.jobAd.company").value("넥스트랩"));
		assertThat(jdbc.queryForObject("SELECT status FROM recruiter_ads WHERE id = ?", String.class, adId)).isEqualTo("HIDDEN");
		assertThat(jdbc.queryForObject("SELECT hidden_at FROM recruiter_ads WHERE id = ?", Object.class, adId)).isNotNull();
		assertThat(jdbc.queryForObject("SELECT deleted_at FROM recruiter_ads WHERE id = ?", Object.class, adId)).isNull();
		assertThat(jdbc.queryForObject(
				"SELECT count(*) FROM notifications WHERE user_id = ? AND notification_type = 'REPORT_OUTCOME'",
				Long.class, recruiter.getId())).isEqualTo(1);
		assertThat(jdbc.queryForObject(
				"SELECT payload::text FROM notifications WHERE user_id = ? AND notification_type = 'REPORT_OUTCOME'",
				String.class, recruiter.getId()))
				.contains("작성한 내용이 숨김 처리됐어요")
				.contains("허위 광고");
	}

	private long insertCase(String targetType, long targetId, long targetUserId) {
		return jdbc.queryForObject("""
				INSERT INTO report_cases (target_type, target_id, target_user_id, reporter_count, status, created_at, updated_at)
				VALUES (?, ?, ?, 1, 'PENDING', now(), now())
				RETURNING id
				""", Long.class, targetType, targetId, targetUserId);
	}

	@Test
	void recruiterCanSignUpLogInAndReadSentOffers() throws Exception {
		when(mail.configured()).thenReturn(true);
		when(mail.freeDomains()).thenReturn(java.util.List.of(
				"gmail.com", "naver.com", "daum.net", "kakao.com", "hanmail.net",
				"outlook.com", "hotmail.com", "yahoo.com", "icloud.com"));
		when(mail.publicBaseUrl()).thenReturn("http://localhost:3000");
		mockMvc.perform(post("/api/v1/public/recruiter-signup/email-codes")
						.contentType(MediaType.APPLICATION_JSON)
						.content("{\"email\":\"someone@gmail.com\"}"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("FREE_EMAIL_DOMAIN"));

		mockMvc.perform(post("/api/v1/public/recruiter-signup/email-codes")
						.contentType(MediaType.APPLICATION_JSON)
						.content("{\"email\":\"recruiter@nextlab.example\"}"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.sent").value(true))
				.andExpect(jsonPath("$.validMinutes").value(10));
		ArgumentCaptor<String> mailBody = ArgumentCaptor.forClass(String.class);
		verify(mail).send(eq("recruiter@nextlab.example"), anyString(), mailBody.capture());
		String code = mailBody.getValue().replaceAll("(?s).*코드는 (\\d{6}).*", "$1");
		String wrongCode = "000000".equals(code) ? "000001" : "000000";

		mockMvc.perform(post("/api/v1/public/recruiter-signup/email-codes/verify")
						.contentType(MediaType.APPLICATION_JSON)
						.content("{\"email\":\"recruiter@nextlab.example\",\"code\":\"" + wrongCode + "\"}"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("CODE_MISMATCH"));
		MvcResult verified = mockMvc.perform(post("/api/v1/public/recruiter-signup/email-codes/verify")
						.contentType(MediaType.APPLICATION_JSON)
						.content("{\"email\":\"recruiter@nextlab.example\",\"code\":\"" + code + "\"}"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.emailDomain").value("nextlab.example"))
				.andReturn();
		String signupToken = verified.getResponse().getContentAsString(StandardCharsets.UTF_8).replaceAll(".*\"signupToken\"\\s*:\\s*\"([^\"]+)\".*", "$1");

		MvcResult signed = mockMvc.perform(post("/api/v1/public/recruiter-signup")
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{"signupToken":"%s","password":"password1234","name":"송지현","company":"넥스트랩","jobTitle":"리크루터","websiteUrl":"https://nextlab.example","consents":{"ageConfirmed":true,"termsAccepted":true,"businessTermsAccepted":true,"personalDataAccepted":true,"marketingAccepted":false}}
								""".formatted(signupToken)))
				.andExpect(status().isOk())
				.andExpect(header().exists("Set-Cookie"))
				.andReturn();
		String login = signed.getResponse().getContentAsString(StandardCharsets.UTF_8).replaceAll(".*\"login\"\\s*:\\s*\"([^\"]+)\".*", "$1");
		assertThat(login).startsWith("r-");
		String recruiterCookie = cookieValue(signed.getResponse().getHeader("Set-Cookie"));
		mockMvc.perform(get("/api/v1/user/me").cookie(cookie(recruiterCookie)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.userType").value("RECRUITER"))
				.andExpect(jsonPath("$.onboarded").value(true));
		mockMvc.perform(get("/api/v1/recruiter/offers").cookie(cookie(recruiterCookie)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.items").isEmpty());
		mockMvc.perform(get("/api/v1/recruiter/me/profile").cookie(cookie(recruiterCookie)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.kind").value("RECRUITER"))
				.andExpect(jsonPath("$.name").value("송지현"))
				.andExpect(jsonPath("$.company").value("넥스트랩"))
				.andExpect(jsonPath("$.companyEmail").value("recruiter@nextlab.example"));
		mockMvc.perform(patch("/api/v1/recruiter/me/profile")
						.cookie(cookie(recruiterCookie))
						.contentType(MediaType.APPLICATION_JSON)
						.content("{\"name\":\"송지현\",\"company\":\"새 회사\",\"jobTitle\":\"테크 리크루터\",\"websiteUrl\":\"\"}"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.company").value("새 회사"))
				.andExpect(jsonPath("$.jobTitle").value("테크 리크루터"))
				.andExpect(jsonPath("$.websiteUrl").value(""))
				.andExpect(jsonPath("$.companyEmail").value("recruiter@nextlab.example"));
		mockMvc.perform(get("/api/v1/public/users/" + login))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.name").value("송지현"))
				.andExpect(jsonPath("$.company").value("새 회사"));
		User recruiter = users.findByUsername(login).orElseThrow();
		String otherSession = sessions.issue(recruiter, "other", "127.0.0.1").rawToken();
		mockMvc.perform(patch("/api/v1/recruiter/me/password")
						.cookie(cookie(recruiterCookie))
						.contentType(MediaType.APPLICATION_JSON)
						.content("{\"currentPassword\":\"wrong1234\",\"newPassword\":\"changed1234\"}"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("INVALID_PASSWORD"));
		mockMvc.perform(patch("/api/v1/recruiter/me/password")
						.cookie(cookie(recruiterCookie))
						.contentType(MediaType.APPLICATION_JSON)
						.content("{\"currentPassword\":\"password1234\",\"newPassword\":\"changed1234\"}"))
				.andExpect(status().isNoContent());
		mockMvc.perform(get("/api/v1/user/me").cookie(cookie(otherSession)))
				.andExpect(status().isUnauthorized());
		mockMvc.perform(get("/api/v1/user/me").cookie(cookie(recruiterCookie)))
				.andExpect(status().isOk());

		User developer = saveUser("offeree", UserType.DEVELOPER);
		String developerToken = sessions.issue(developer, "JUnit", "127.0.0.1").rawToken();
		mockMvc.perform(patch("/api/v1/recruiter/me/profile")
						.cookie(cookie(developerToken))
						.contentType(MediaType.APPLICATION_JSON)
						.content("{\"name\":\"송지현\",\"company\":\"새 회사\",\"jobTitle\":\"테크 리크루터\"}"))
				.andExpect(status().isForbidden());
		mockMvc.perform(patch("/api/v1/recruiter/me/password")
						.cookie(cookie(developerToken))
						.contentType(MediaType.APPLICATION_JSON)
						.content("{\"currentPassword\":\"password1234\",\"newPassword\":\"changed1234\"}"))
				.andExpect(status().isForbidden());
		mockMvc.perform(get("/api/v1/recruiter/offers").cookie(cookie(sessions.issue(developer, "JUnit", "127.0.0.1").rawToken())))
				.andExpect(status().isForbidden());

		mockMvc.perform(post("/api/v1/public/recruiter-auth/login")
						.contentType(MediaType.APPLICATION_JSON)
						.content("{\"email\":\"recruiter@nextlab.example\",\"password\":\"wrong1234\",\"returnTo\":\"/recruiter/offers\"}"))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.code").value("LOGIN_FAILED"));
		mockMvc.perform(post("/api/v1/public/recruiter-auth/login")
						.contentType(MediaType.APPLICATION_JSON)
						.content("{\"email\":\"missing@nextlab.example\",\"password\":\"password1234\"}"))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.message").value("이메일 또는 비밀번호가 맞지 않아요"));

		mockMvc.perform(post("/api/v1/public/recruiter-auth/password-reset-requests")
						.contentType(MediaType.APPLICATION_JSON)
						.content("{\"email\":\"missing@nextlab.example\"}"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.sent").value(true));
		mockMvc.perform(post("/api/v1/public/recruiter-auth/password-reset-requests")
						.contentType(MediaType.APPLICATION_JSON)
						.content("{\"email\":\"recruiter@nextlab.example\"}"))
				.andExpect(status().isOk());
		verify(mail, org.mockito.Mockito.atLeastOnce()).send(eq("recruiter@nextlab.example"), anyString(), mailBody.capture());
		String resetToken = mailBody.getValue().replaceAll("(?s).*token=([^\\s]+).*", "$1");
		mockMvc.perform(get("/api/v1/public/recruiter-auth/password-reset/" + resetToken))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.valid").value(true));
		mockMvc.perform(post("/api/v1/public/recruiter-auth/password-reset")
						.contentType(MediaType.APPLICATION_JSON)
						.content("{\"token\":\"" + resetToken + "\",\"newPassword\":\"newpass1234\"}"))
				.andExpect(status().isNoContent());
		mockMvc.perform(get("/api/v1/user/me").cookie(cookie(recruiterCookie)))
				.andExpect(status().isUnauthorized());
		MvcResult loggedIn = mockMvc.perform(post("/api/v1/public/recruiter-auth/login")
						.contentType(MediaType.APPLICATION_JSON)
						.content("{\"email\":\"recruiter@nextlab.example\",\"password\":\"newpass1234\",\"returnTo\":\"/recruiter/offers\"}"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.restored").value(false))
				.andExpect(jsonPath("$.returnTo").value("/recruiter/offers"))
				.andReturn();
		String session = cookieValue(loggedIn.getResponse().getHeader("Set-Cookie"));

		long recruiterId = jdbc.queryForObject("SELECT id FROM users WHERE username = ?", Long.class, login);
		long waiting = recruitingRoom(recruiterId, developer.getId(), "wait-room", "REQUESTED", "now() + interval '20 days'");
		long talking = recruitingRoom(recruiterId, developer.getId(), "talk-room", "ACCEPTED", "null");
		User quiet = saveUser("quietdev", UserType.DEVELOPER);
		recruitingRoom(recruiterId, quiet.getId(), "quiet-room", "REQUESTED", "now() - interval '1 day'");
		jdbc.update("""
				INSERT INTO chat_messages (room_id, sender_id, message_type, body, visibility, created_at, updated_at)
				VALUES (?, ?, 'TEXT', '안녕하세요', 'VISIBLE', now(), now())
				""", waiting, recruiterId);

		mockMvc.perform(get("/api/v1/recruiter/offers").param("status", "WAITING").cookie(cookie(session)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.items.length()").value(1))
				.andExpect(jsonPath("$.items[0].roomId").value(waiting))
				.andExpect(jsonPath("$.items[0].developer.login").value("offeree"))
				.andExpect(jsonPath("$.items[0].firstMessage").value("안녕하세요"));
		mockMvc.perform(get("/api/v1/recruiter/offers").param("status", "TALKING").cookie(cookie(session)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.items[0].roomId").value(talking));
		mockMvc.perform(get("/api/v1/recruiter/offers/counts").cookie(cookie(session)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.TALKING").value(1))
				.andExpect(jsonPath("$.WAITING").value(1))
				.andExpect(jsonPath("$.NO_RESPONSE").value(1));
		mockMvc.perform(get("/api/v1/recruiter/offers/" + waiting + "/first-message").cookie(cookie(session)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.text").value("안녕하세요"));
		mockMvc.perform(get("/api/v1/recruiter/offers/summary").cookie(cookie(session)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.todayLimit").value(10))
				.andExpect(jsonPath("$.scoutTodayLimit").value(50))
				.andExpect(jsonPath("$.scoutSubscribed").value(false))
				.andExpect(jsonPath("$.todayUsed").value(3));
	}

	private long recruitingRoom(long recruiterId, long developerId, String dmKey, String status, String expiresSql) {
		long roomId = jdbc.queryForObject("""
				INSERT INTO chat_rooms (room_type, dm_key, dm_status, request_kind, requester_id, request_expires_at, created_at, updated_at)
				VALUES ('DIRECT', ?, '%s', 'RECRUITING', ?, %s, now(), now())
				RETURNING id
				""".formatted(status, expiresSql), Long.class, dmKey, recruiterId);
		jdbc.update("""
				INSERT INTO chat_room_members (room_id, user_id, muted, joined_at, created_at, updated_at)
				VALUES (?, ?, false, now(), now(), now())
				""", roomId, recruiterId);
		jdbc.update("""
				INSERT INTO chat_room_members (room_id, user_id, muted, joined_at, created_at, updated_at)
				VALUES (?, ?, false, now(), now(), now())
				""", roomId, developerId);
		return roomId;
	}

	@Test
	void includedProfileDataAndJobAdFollowThePolicy() throws Exception {
		User developer = saveUser("octo", UserType.DEVELOPER);
		developer.markContributionSynced(Instant.now());
		users.saveAndFlush(developer);
		LocalDate day = LocalDate.now(PlanLimits.APP_ZONE).withDayOfMonth(2);
		jdbc.update("""
				insert into contribution_days (user_id, day, contribution_count, created_at, updated_at)
				values (?, ?, 4, now(), now())
				""", developer.getId(), day);
		mockMvc.perform(get("/api/v1/public/users/octo/contributions").param("month", day.toString().substring(0, 7)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.month").value(day.toString().substring(0, 7)))
				.andExpect(jsonPath("$.days[0].count").value(4));

		jdbc.update("""
				insert into username_redirects (old_username, user_id, expires_at, created_at, updated_at)
				values ('old-octo', ?, now() + interval '90 days', now(), now())
				""", developer.getId());
		mockMvc.perform(get("/api/v1/public/users/old-octo"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.login").value("octo"))
				.andExpect(jsonPath("$.redirectedFrom").value("old-octo"));

		Cookie developerCookie = cookie(sessions.issue(developer, "JUnit", "127.0.0.1").rawToken());
		mockMvc.perform(patch("/api/v1/user/me/profile")
						.cookie(developerCookie)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{"name":"옥토","bio":"","blogUrl":"","techStack":[],"lookingForTeam":false,"jobStatus":"OFF","jobCategories":["FRONTEND","BACKEND"]}
								"""))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.jobCategories[0]").value("FRONTEND"))
				.andExpect(jsonPath("$.jobCategories[1]").value("BACKEND"));

		User recruiter = saveUser("r-ad", UserType.RECRUITER);
		recruiter.completeOnboarding(Instant.now());
		users.saveAndFlush(recruiter);
		jdbc.update("""
				insert into recruiter_profiles
				    (user_id, company_name, company_email_domain, job_title, company_url, email_verified_at, created_at, updated_at)
				values (?, '넥스트랩', 'nextlab.example', '리쿠르터', null, now(), now(), now())
				""", recruiter.getId());
		Cookie recruiterCookie = cookie(sessions.issue(recruiter, "JUnit", "127.0.0.1").rawToken());
		mockMvc.perform(get("/api/v1/public/users/octo").cookie(recruiterCookie))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.jobStatus").exists());
		Integer visits = jdbc.queryForObject(
				"select count(*) from profile_visits where profile_user_id = ? and visitor_id = ?",
				Integer.class,
				developer.getId(),
				recruiter.getId());
		assertThat(visits).isEqualTo(1);
		mockMvc.perform(get("/api/v1/public/users/r-ad"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.company").value("넥스트랩"))
				.andExpect(jsonPath("$.companyEmailDomain").value("nextlab.example"));

		mockMvc.perform(get("/api/v1/recruiter/me/ad").cookie(recruiterCookie))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.subscribed").value(false))
				.andExpect(jsonPath("$.ad").value(nullValue()));
		mockMvc.perform(put("/api/v1/recruiter/me/ad")
						.cookie(recruiterCookie)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{"jobCategory":"FRONTEND","title":"프론트엔드 개발자","url":"https://www.wanted.co.kr/wd/1","closesOn":"%s"}
								""".formatted(LocalDate.now(PlanLimits.APP_ZONE).plusDays(10))))
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.message").value("Scout를 구독하면 관심 직군이 맞는 개발자의 피드에 채용 광고를 띄울 수 있어요."));
	}

	@Test
	void unknownFailuresDoNotEchoTheException() throws Exception {
		mockMvc.perform(get("/api/v1/public/missing"))
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.code").value("NOT_FOUND"))
				.andExpect(jsonPath("$.message").value("대상을 찾을 수 없어요"));
	}

	@Test
	void mondayRecruiterViewNoticeGoesToProDevelopers() {
		LocalDate today = LocalDate.now(PlanLimits.APP_ZONE);
		LocalDate weekEnd = today.with(TemporalAdjusters.previous(DayOfWeek.SUNDAY));
		LocalDate weekStart = weekEnd.minusDays(6);
		User active = saveUser("proactive", UserType.DEVELOPER);
		User grace = saveUser("prograce", UserType.DEVELOPER);
		User ended = saveUser("proended", UserType.DEVELOPER);
		User free = saveUser("freeview", UserType.DEVELOPER);
		User first = saveUser("recruiter-a", UserType.RECRUITER);
		User second = saveUser("recruiter-b", UserType.RECRUITER);
		User earlier = saveUser("recruiter-c", UserType.RECRUITER);
		visits.saveAndFlush(ProfileVisit.record(active, first, weekStart));
		visits.saveAndFlush(ProfileVisit.record(active, first, weekStart.plusDays(1)));
		visits.saveAndFlush(ProfileVisit.record(active, second, weekStart.plusDays(2)));
		visits.saveAndFlush(ProfileVisit.record(active, earlier, weekStart.minusDays(1)));
		visits.saveAndFlush(ProfileVisit.record(grace, first, weekStart));
		visits.saveAndFlush(ProfileVisit.record(ended, first, weekStart));
		visits.saveAndFlush(ProfileVisit.record(free, first, weekStart));
		try {
			jdbc.update("""
					insert into subscriptions (user_id, payer_user_id, plan, billing_cycle, status,
					  current_period_start, current_period_end, grace_until, created_at, updated_at)
					values (?, ?, 'PRO', 'MONTHLY', 'ACTIVE', now() - interval '1 day', now() + interval '30 days', null, now(), now())
					""", active.getId(), active.getId());
			jdbc.update("""
					insert into subscriptions (user_id, payer_user_id, plan, billing_cycle, status,
					  current_period_start, current_period_end, grace_until, created_at, updated_at)
					values (?, ?, 'PRO', 'MONTHLY', 'PAST_DUE', now() - interval '31 days', now() - interval '1 day', now() + interval '7 days', now(), now())
					""", grace.getId(), grace.getId());
			jdbc.update("""
					insert into subscriptions (user_id, payer_user_id, plan, billing_cycle, status,
					  current_period_start, current_period_end, grace_until, created_at, updated_at)
					values (?, ?, 'PRO', 'MONTHLY', 'PAST_DUE', now() - interval '32 days', now() - interval '2 days', now() - interval '1 day', now(), now())
					""", ended.getId(), ended.getId());

			recruiterViewNotices.run();

			assertViewNotice(active.getId(), "proactive", 2, weekStart);
			assertViewNotice(grace.getId(), "prograce", 1, weekStart);
			assertThat(noticeCount(ended.getId())).isZero();
			assertThat(noticeCount(free.getId())).isZero();

			recruiterViewNotices.run();
			assertThat(noticeCount(active.getId())).isEqualTo(1);
			assertThat(noticeCount(grace.getId())).isEqualTo(1);
		}
		finally {
			jdbc.update("delete from subscriptions where user_id in (?, ?, ?)", active.getId(), grace.getId(), ended.getId());
		}

		User later = saveUser("laterpro", UserType.DEVELOPER);
		visits.saveAndFlush(ProfileVisit.record(later, first, weekStart));
		recruiterViewNotices.run();
		assertThat(noticeCount(later.getId())).isZero();
		assertThat(noticeCount(active.getId())).isEqualTo(1);
	}

	@Test
	void recruiterLoginLocksAfterFiveFailures() throws Exception {
		String email = "lock@nextlab.example";
		User recruiter = saveUser("lock-user", UserType.RECRUITER);
		identities.saveAndFlush(AuthIdentity.email(recruiter, email, passwords.encode("password1234"), Instant.now()));
		String wrong = "{\"email\":\"" + email + "\",\"password\":\"wrong1234\"}";
		String right = "{\"email\":\"" + email + "\",\"password\":\"password1234\"}";

		for (int attempt = 1; attempt <= 4; attempt++) {
			mockMvc.perform(post("/api/v1/public/recruiter-auth/login")
							.contentType(MediaType.APPLICATION_JSON)
							.content(wrong))
					.andExpect(status().isUnauthorized())
					.andExpect(jsonPath("$.code").value("LOGIN_FAILED"))
					.andExpect(jsonPath("$.detail.remainingAttempts").value(PlanLimits.RECRUITER_LOGIN_ATTEMPTS - attempt));
		}
		mockMvc.perform(post("/api/v1/public/recruiter-auth/login")
						.contentType(MediaType.APPLICATION_JSON)
						.content(wrong))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.code").value("LOGIN_FAILED"))
				.andExpect(jsonPath("$.detail.remainingAttempts").value(0));
		assertThat(jdbc.queryForObject(
				"select failed_login_count from auth_identities where provider_user_id = ?",
				Integer.class, email)).isEqualTo(PlanLimits.RECRUITER_LOGIN_ATTEMPTS);
		assertThat(jdbc.queryForObject(
				"select locked_until > now() from auth_identities where provider_user_id = ?",
				Boolean.class, email)).isTrue();

		mockMvc.perform(post("/api/v1/public/recruiter-auth/login")
						.contentType(MediaType.APPLICATION_JSON)
						.content(right))
				.andExpect(status().isTooManyRequests())
				.andExpect(jsonPath("$.code").value("LOGIN_LOCKED"))
				.andExpect(jsonPath("$.message").value("비밀번호를 5번 틀려 10분 동안 로그인할 수 없어요"))
				.andExpect(jsonPath("$.detail.lockMinutes").value(PlanLimits.RECRUITER_LOGIN_LOCK_MINUTES));

		jdbc.update("update auth_identities set locked_until = now() - interval '1 minute' where provider_user_id = ?", email);
		mockMvc.perform(post("/api/v1/public/recruiter-auth/login")
						.contentType(MediaType.APPLICATION_JSON)
						.content(right))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.restored").value(false));
		assertThat(jdbc.queryForObject(
				"select failed_login_count from auth_identities where provider_user_id = ?",
				Integer.class, email)).isZero();
		assertThat(jdbc.queryForObject(
				"select locked_until from auth_identities where provider_user_id = ?",
				Object.class, email)).isNull();
	}

	@Test
	void recruiterCannotCallDeveloperOnlyWriteApis() throws Exception {
		User recruiter = saveUser("writer", UserType.RECRUITER);
		Cookie cookie = cookie(sessions.issue(recruiter, "JUnit", "127.0.0.1").rawToken());
		String issue = "{\"requestId\":\"00000000-0000-0000-0000-000000000001\",\"repoId\":1,\"title\":\"이슈\"}";

		expectDeveloperOnly(cookie, patch("/api/v1/user/me/profile").contentType(MediaType.APPLICATION_JSON).content("{}"));
		expectDeveloperOnly(cookie, post("/api/v1/user/me/profile/github-sync"));
		expectDeveloperOnly(cookie, post("/api/v1/user/users/someone/follow"));
		expectDeveloperOnly(cookie, delete("/api/v1/user/users/someone/follow"));
		expectDeveloperOnly(cookie, post("/api/v1/user/onboarding/agreements")
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"ageConfirmed\":true,\"termsAccepted\":true,\"privacyAccepted\":true,\"marketingAccepted\":false,\"termsVersion\":\"v\"}"));
		expectDeveloperOnly(cookie, put("/api/v1/user/onboarding/profile")
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"name\":\"이름\",\"lookingForTeam\":false}"));
		expectDeveloperOnly(cookie, put("/api/v1/user/onboarding/email")
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"email\":\"recruiter@nextlab.example\"}"));
		expectDeveloperOnly(cookie, post("/api/v1/user/team-setup/installations/verify")
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"installationId\":\"1\",\"state\":\"state\",\"setupAction\":\"install\"}"));
		expectDeveloperOnly(cookie, post("/api/v1/user/teams")
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"installationId\":\"1\",\"name\":\"팀\"}"));
		expectDeveloperOnly(cookie, put("/api/v1/user/teams/1/setup/repos")
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"repoIds\":[]}"));
		expectDeveloperOnly(cookie, post("/api/v1/user/teams/1/setup/board")
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"mode\":\"NEW\"}"));
		expectDeveloperOnly(cookie, post("/api/v1/user/teams/1/setup/complete"));
		expectDeveloperOnly(cookie, post("/api/v1/user/teams/1/issues/refresh"));
		expectDeveloperOnly(cookie, post("/api/v1/user/teams/1/issues/1/project-item"));
		expectDeveloperOnly(cookie, put("/api/v1/user/teams/1/issues/1/assignees")
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"userIds\":[]}"));
		expectDeveloperOnly(cookie, put("/api/v1/user/teams/1/issues/1/labels")
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"labels\":[]}"));
		expectDeveloperOnly(cookie, put("/api/v1/user/teams/1/issues/1/schedule")
				.contentType(MediaType.APPLICATION_JSON)
				.content("{}"));
		expectDeveloperOnly(cookie, put("/api/v1/user/teams/1/issues/1/status")
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"status\":\"TODO\"}"));
		expectDeveloperOnly(cookie, post("/api/v1/user/teams/1/issues")
				.contentType(MediaType.APPLICATION_JSON)
				.content(issue));
		expectDeveloperOnly(cookie, post("/api/v1/user/chat-rooms/direct")
				.contentType(MediaType.APPLICATION_JSON)
				.content("{}"));
		expectDeveloperOnly(cookie, post("/api/v1/user/posts").contentType(MediaType.APPLICATION_JSON).content("{}"));
		expectDeveloperOnly(cookie, put("/api/v1/user/posts/1").contentType(MediaType.APPLICATION_JSON).content("{}"));
		expectDeveloperOnly(cookie, post("/api/v1/user/posts/1/likes"));
		expectDeveloperOnly(cookie, delete("/api/v1/user/posts/1/likes"));
		expectDeveloperOnly(cookie, post("/api/v1/user/posts/1/comments").contentType(MediaType.APPLICATION_JSON).content("{}"));
		expectDeveloperOnly(cookie, patch("/api/v1/user/posts/1/comments/1").contentType(MediaType.APPLICATION_JSON).content("{}"));
		expectDeveloperOnly(cookie, delete("/api/v1/user/posts/1/comments/1"));
		expectDeveloperOnly(cookie, delete("/api/v1/user/posts/1"));
		expectDeveloperOnly(cookie, delete("/api/v1/user/me/applications/1"));
		expectDeveloperOnly(cookie, post("/api/v1/user/recruits").contentType(MediaType.APPLICATION_JSON).content("{}"));
		expectDeveloperOnly(cookie, put("/api/v1/user/recruits/1").contentType(MediaType.APPLICATION_JSON).content("{}"));
		expectDeveloperOnly(cookie, post("/api/v1/user/recruits/1/close"));
		expectDeveloperOnly(cookie, post("/api/v1/user/recruits/1/reopen"));
		expectDeveloperOnly(cookie, delete("/api/v1/user/recruits/1"));
		expectDeveloperOnly(cookie, post("/api/v1/user/recruits/1/applications").contentType(MediaType.APPLICATION_JSON).content("{}"));
		expectDeveloperOnly(cookie, post("/api/v1/user/recruits/1/applications/1/accept"));
		expectDeveloperOnly(cookie, post("/api/v1/user/recruits/1/applications/1/reject"));
	}

	private void expectDeveloperOnly(Cookie cookie, MockHttpServletRequestBuilder request) throws Exception {
		mockMvc.perform(request.cookie(cookie))
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.code").value("DEVELOPER_ONLY"))
				.andExpect(jsonPath("$.message").value("개발자만 사용할 수 있어요"));
	}

	private void assertViewNotice(long userId, String username, int count, LocalDate weekStart) {
		String message = "이번 주 채용 담당자 " + count + "명이 내 프로필을 봤어요.";
		assertThat(noticeCount(userId)).isEqualTo(1);
		assertThat(jdbc.queryForObject(
				"select notification_type from notifications where user_id = ?", String.class, userId))
				.isEqualTo("RECRUITER_PROFILE_VIEW");
		assertThat(jdbc.queryForObject(
				"select payload::text from notifications where user_id = ?", String.class, userId))
				.isEqualTo("{\"message\": \"" + message + "\"}");
		assertThat(jdbc.queryForObject(
				"select link_path from notifications where user_id = ?", String.class, userId))
				.isEqualTo("/user/" + username);
		assertThat(jdbc.queryForObject(
				"select group_key from notifications where user_id = ?", String.class, userId))
				.isEqualTo("recruiter-view:" + weekStart);
		assertThat(jdbc.queryForObject(
				"select actor_id from notifications where user_id = ?", Long.class, userId)).isNull();
		assertThat(jdbc.queryForObject(
				"select deliver_after from notifications where user_id = ?", Object.class, userId)).isNull();
	}

	private long noticeCount(long userId) {
		Long count = jdbc.queryForObject("select count(*) from notifications where user_id = ?", Long.class, userId);
		return count == null ? 0 : count;
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

	@Test
	void pinnedPostsReplaceOrderAndStayAfterProEnds() throws Exception {
		User developer = saveUser("pinner", UserType.DEVELOPER);
		User other = saveUser("otherpin", UserType.DEVELOPER);
		User recruiter = saveUser("pinrecruiter", UserType.RECRUITER);
		String token = sessions.issue(developer, "JUnit", "127.0.0.1").rawToken();
		long[] posts = new long[6];
		try {
			for (int i = 0; i < 6; i++) {
				long repoId = insertPinRepo(9_200_000L + i, "pinner/work-" + i);
				posts[i] = insertPinPost(developer.getId(), repoId, 6 - i);
			}
			long otherRepo = insertPinRepo(9_200_100L, "otherpin/work");
			long otherPost = insertPinPost(other.getId(), otherRepo, 1);

			mockMvc.perform(put("/api/v1/user/me/pinned-posts")
							.cookie(cookie(token))
							.contentType(MediaType.APPLICATION_JSON)
							.content(pinBody(posts[0])))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.pinnedPostIds[0]").value(posts[0]));
			mockMvc.perform(get("/api/v1/public/users/pinner"))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.pinnedPostIds[0]").value(posts[0]));
			mockMvc.perform(get("/api/v1/public/users/pinner/posts"))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.items[0].id").value(posts[0]))
					.andExpect(jsonPath("$.items[1].id").value(posts[5]));

			mockMvc.perform(put("/api/v1/user/me/pinned-posts")
							.cookie(cookie(token))
							.contentType(MediaType.APPLICATION_JSON)
							.content(pinBody(posts[0], posts[5])))
					.andExpect(status().isForbidden())
					.andExpect(jsonPath("$.code").value("PLAN_LIMIT"))
					.andExpect(jsonPath("$.message").value(
							"대표 작업물은 1개까지 고정할 수 있어요. Pro로 5개까지 늘릴 수 있어요"));
			assertThat(jdbc.queryForObject(
					"SELECT post_id FROM pinned_posts WHERE user_id = ?", Long.class, developer.getId()))
					.isEqualTo(posts[0]);

			mockMvc.perform(put("/api/v1/user/me/pinned-posts")
							.cookie(cookie(token))
							.contentType(MediaType.APPLICATION_JSON)
							.content(pinBody(otherPost)))
					.andExpect(status().isForbidden())
					.andExpect(jsonPath("$.code").value("FORBIDDEN"))
					.andExpect(jsonPath("$.message").value("내 게시물이 아니에요"));
			mockMvc.perform(put("/api/v1/user/me/pinned-posts")
							.cookie(cookie(token))
							.contentType(MediaType.APPLICATION_JSON)
							.content(pinBody(posts[0], posts[0])))
					.andExpect(status().isBadRequest())
					.andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));

			jdbc.update("UPDATE posts SET visibility = 'HIDDEN' WHERE id = ?", posts[0]);
			mockMvc.perform(get("/api/v1/public/users/pinner"))
					.andExpect(jsonPath("$.pinnedPostIds").isEmpty());
			mockMvc.perform(put("/api/v1/user/me/pinned-posts")
							.cookie(cookie(token))
							.contentType(MediaType.APPLICATION_JSON)
							.content(pinBody(posts[0])))
					.andExpect(status().isNotFound())
					.andExpect(jsonPath("$.message").value("삭제되었거나 볼 수 없는 콘텐츠예요"));
			assertThat(jdbc.queryForObject(
					"SELECT count(*) FROM pinned_posts WHERE user_id = ?", Long.class, developer.getId()))
					.isEqualTo(1L);
			jdbc.update("UPDATE posts SET visibility = 'VISIBLE', deleted_at = now() WHERE id = ?", posts[0]);
			mockMvc.perform(put("/api/v1/user/me/pinned-posts")
							.cookie(cookie(token))
							.contentType(MediaType.APPLICATION_JSON)
							.content(pinBody(posts[0])))
					.andExpect(status().isNotFound());
			jdbc.update("UPDATE posts SET deleted_at = NULL WHERE id = ?", posts[0]);

			String recruiterToken = sessions.issue(recruiter, "JUnit", "127.0.0.1").rawToken();
			mockMvc.perform(put("/api/v1/user/me/pinned-posts")
							.cookie(cookie(recruiterToken))
							.contentType(MediaType.APPLICATION_JSON)
							.content(pinBody(posts[1])))
					.andExpect(status().isForbidden())
					.andExpect(jsonPath("$.code").value("DEVELOPER_ONLY"));
			mockMvc.perform(get("/api/v1/public/users/pinrecruiter"))
					.andExpect(jsonPath("$.pinnedPostIds").isEmpty());

			jdbc.update("""
					INSERT INTO subscriptions (user_id, payer_user_id, plan, billing_cycle, status,
					    current_period_start, current_period_end, created_at, updated_at)
					VALUES (?, ?, 'PRO', 'MONTHLY', 'ACTIVE', now(), now() + interval '1 day', now(), now())
					""", developer.getId(), developer.getId());
			mockMvc.perform(put("/api/v1/user/me/pinned-posts")
							.cookie(cookie(token))
							.contentType(MediaType.APPLICATION_JSON)
							.content(pinBody(posts[1], posts[3], posts[5], posts[4], posts[2])))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.pinnedPostIds[0]").value(posts[1]))
					.andExpect(jsonPath("$.pinnedPostIds[4]").value(posts[2]));
			mockMvc.perform(get("/api/v1/public/users/pinner/posts"))
					.andExpect(jsonPath("$.items[0].id").value(posts[1]))
					.andExpect(jsonPath("$.items[1].id").value(posts[3]))
					.andExpect(jsonPath("$.items[2].id").value(posts[5]))
					.andExpect(jsonPath("$.items[3].id").value(posts[4]))
					.andExpect(jsonPath("$.items[4].id").value(posts[2]))
					.andExpect(jsonPath("$.items[5].id").value(posts[0]));

			jdbc.update("DELETE FROM subscriptions WHERE user_id = ?", developer.getId());
			mockMvc.perform(get("/api/v1/public/users/pinner"))
					.andExpect(jsonPath("$.pinnedPostIds[0]").value(posts[1]))
					.andExpect(jsonPath("$.pinnedPostIds[4]").value(posts[2]));
			mockMvc.perform(put("/api/v1/user/me/pinned-posts")
							.cookie(cookie(token))
							.contentType(MediaType.APPLICATION_JSON)
							.content(pinBody(posts[2], posts[4], posts[5], posts[3], posts[1])))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.pinnedPostIds[0]").value(posts[2]));
			mockMvc.perform(put("/api/v1/user/me/pinned-posts")
							.cookie(cookie(token))
							.contentType(MediaType.APPLICATION_JSON)
							.content(pinBody(posts[2], posts[4], posts[5], posts[3], posts[1], posts[0])))
					.andExpect(status().isForbidden())
					.andExpect(jsonPath("$.code").value("PLAN_LIMIT"))
					.andExpect(jsonPath("$.message").value(
							"대표 작업물은 1개까지 고정할 수 있어요. Pro로 5개까지 늘릴 수 있어요"));
			assertThat(jdbc.queryForObject(
					"SELECT post_id FROM pinned_posts WHERE user_id = ? ORDER BY sort_order LIMIT 1",
					Long.class, developer.getId())).isEqualTo(posts[2]);

			mockMvc.perform(put("/api/v1/user/me/pinned-posts")
							.cookie(cookie(token))
							.contentType(MediaType.APPLICATION_JSON)
							.content("{\"postIds\":[]}"))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.pinnedPostIds").isEmpty());
			mockMvc.perform(get("/api/v1/public/users/pinner/posts"))
					.andExpect(jsonPath("$.items[0].id").value(posts[5]));
			mockMvc.perform(get("/api/v1/public/users/pinner"))
					.andExpect(jsonPath("$.pinnedPostIds").isEmpty());
		}
		finally {
			jdbc.update("DELETE FROM subscriptions WHERE user_id = ?", developer.getId());
		}
	}

	private long insertPinRepo(long githubRepoId, String fullName) {
		int slash = fullName.indexOf('/');
		return jdbc.queryForObject("""
				INSERT INTO github_repos (github_repo_id, owner_login, name, full_name, created_at, updated_at)
				VALUES (?, ?, ?, ?, now(), now())
				RETURNING id
				""", Long.class, githubRepoId, fullName.substring(0, slash), fullName.substring(slash + 1), fullName);
	}

	private long insertPinPost(long authorId, long repoId, int ageDays) {
		return jdbc.queryForObject("""
				INSERT INTO posts (author_id, repo_id, summary, body, visibility, created_at, updated_at)
				VALUES (?, ?, '요약', '본문', 'VISIBLE', now() - (? * interval '1 day'), now())
				RETURNING id
				""", Long.class, authorId, repoId, ageDays);
	}

	private static String pinBody(long... postIds) {
		StringBuilder body = new StringBuilder("{\"postIds\":[");
		for (int i = 0; i < postIds.length; i++) {
			if (i > 0) {
				body.append(',');
			}
			body.append(postIds[i]);
		}
		return body.append("]}").toString();
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
