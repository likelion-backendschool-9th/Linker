package com.linker.backend.controller.user;

import com.linker.backend.dto.account.request.NotificationEmailRequest;
import com.linker.backend.dto.account.request.OnboardingAgreementsRequest;
import com.linker.backend.dto.account.request.OnboardingEmailRequest;
import com.linker.backend.dto.account.request.OnboardingProfileRequest;
import com.linker.backend.dto.account.request.ProfileUpdateRequest;
import com.linker.backend.dto.account.response.GithubProfileSyncResponse;
import com.linker.backend.dto.account.response.NotificationEmailResponse;
import com.linker.backend.dto.account.response.OnboardingResponse;
import com.linker.backend.dto.account.response.ProfileEditResponse;
import com.linker.backend.dto.account.response.ProfilePeopleResponse;
import com.linker.backend.dto.account.response.SettingsResponse;
import com.linker.backend.dto.account.response.WithdrawalCheckResponse;
import com.linker.backend.dto.account.response.WithdrawalResponse;
import com.linker.backend.global.security.AuthenticatedUser;
import com.linker.backend.global.security.DeveloperOnly;
import com.linker.backend.global.security.SessionCookies;
import com.linker.backend.service.AuthService;
import com.linker.backend.service.user.AccountService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController("userAccountController")
@RequestMapping("/user")
public class AccountController {

	private final AccountService accounts;
	private final AuthService auth;
	private final SessionCookies cookies;

	public AccountController(AccountService accounts, AuthService auth, SessionCookies cookies) {
		this.accounts = accounts;
		this.auth = auth;
		this.cookies = cookies;
	}

	@GetMapping("/me/settings")
	@Tag(name = "p06-settings")
	@Operation(operationId = "getSettings")
	public ResponseEntity<SettingsResponse> settings(@AuthenticationPrincipal AuthenticatedUser user) {
		return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(accounts.settings(user));
	}

	@PatchMapping("/me/email")
	@Tag(name = "p06-settings")
	@Operation(operationId = "updateNotificationEmail")
	public ResponseEntity<NotificationEmailResponse> changeEmail(
			@AuthenticationPrincipal AuthenticatedUser user,
			@RequestBody NotificationEmailRequest request) {
		return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(accounts.changeEmail(user, request));
	}

	@GetMapping("/me/withdrawal-check")
	@Tag(name = "p06-settings")
	@Operation(operationId = "getWithdrawalCheck")
	public ResponseEntity<WithdrawalCheckResponse> withdrawalCheck(@AuthenticationPrincipal AuthenticatedUser user) {
		return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(accounts.withdrawalCheck(user));
	}

	@PostMapping("/me/withdrawal")
	@Tag(name = "p06-settings")
	@Operation(operationId = "withdrawAccount")
	public ResponseEntity<WithdrawalResponse> withdraw(@AuthenticationPrincipal AuthenticatedUser user) {
		return ResponseEntity.ok()
				.cacheControl(CacheControl.noStore())
				.header(HttpHeaders.SET_COOKIE, cookies.clear())
				.body(accounts.withdraw(user));
	}

	@GetMapping("/me/profile")
	@DeveloperOnly
	@Tag(name = "p05-profile-edit")
	@Operation(operationId = "getMyProfile")
	public ResponseEntity<ProfileEditResponse> profile(@AuthenticationPrincipal AuthenticatedUser user) {
		return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(accounts.profile(user));
	}

	@PatchMapping("/me/profile")
	@DeveloperOnly
	@Tag(name = "p05-profile-edit")
	@Operation(operationId = "updateMyProfile")
	public ResponseEntity<ProfileEditResponse> updateProfile(
			@AuthenticationPrincipal AuthenticatedUser user,
			@RequestBody ProfileUpdateRequest request) {
		return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(accounts.updateProfile(user, request));
	}

	@PostMapping("/me/profile/github-sync")
	@DeveloperOnly
	@Tag(name = "p05-profile-edit")
	@Operation(operationId = "syncMyProfileFromGithub")
	public ResponseEntity<GithubProfileSyncResponse> syncFromGithub(@AuthenticationPrincipal AuthenticatedUser user) {
		return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(accounts.syncFromGithub(user));
	}

	@GetMapping("/user/{login}/followers")
	@Tag(name = "p04-profile")
	@Operation(operationId = "listFollowers")
	public ResponseEntity<ProfilePeopleResponse> followers(
			@AuthenticationPrincipal AuthenticatedUser user,
			@PathVariable String login,
			@RequestParam(required = false) String cursor) {
		return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(accounts.followers(user, login, cursor));
	}

	@GetMapping("/user/{login}/followings")
	@Tag(name = "p04-profile")
	@Operation(operationId = "listFollowings")
	public ResponseEntity<ProfilePeopleResponse> followings(
			@AuthenticationPrincipal AuthenticatedUser user,
			@PathVariable String login,
			@RequestParam(required = false) String cursor) {
		return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(accounts.followings(user, login, cursor));
	}

	@PostMapping("/user/{login}/follow")
	@DeveloperOnly
	@Tag(name = "p04-profile")
	@Operation(operationId = "followUser")
	public ResponseEntity<Void> follow(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable String login) {
		accounts.follow(user, login);
		return ResponseEntity.noContent().cacheControl(CacheControl.noStore()).build();
	}

	@DeleteMapping("/user/{login}/follow")
	@DeveloperOnly
	@Tag(name = "p04-profile")
	@Operation(operationId = "unfollowUser")
	public ResponseEntity<Void> unfollow(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable String login) {
		accounts.unfollow(user, login);
		return ResponseEntity.noContent().cacheControl(CacheControl.noStore()).build();
	}

	@GetMapping("/onboarding")
	@Tag(name = "p02-onboarding")
	@Operation(operationId = "getOnboarding")
	@DeveloperOnly
	public ResponseEntity<OnboardingResponse> onboarding(@AuthenticationPrincipal AuthenticatedUser user) {
		return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(accounts.onboarding(user));
	}

	@PostMapping("/onboarding/agreements")
	@Tag(name = "p02-onboarding")
	@Operation(operationId = "acceptOnboardingAgreements")
	@DeveloperOnly
	public ResponseEntity<Void> acceptAgreements(
			@AuthenticationPrincipal AuthenticatedUser user,
			@RequestBody OnboardingAgreementsRequest request) {
		accounts.acceptAgreements(user, request);
		return ResponseEntity.noContent().cacheControl(CacheControl.noStore()).build();
	}

	@PutMapping("/onboarding/profile")
	@Tag(name = "p02-onboarding")
	@Operation(operationId = "saveOnboardingProfile")
	@DeveloperOnly
	public ResponseEntity<Void> saveProfile(
			@AuthenticationPrincipal AuthenticatedUser user,
			@RequestBody OnboardingProfileRequest request) {
		accounts.saveProfile(user, request);
		String renewed = auth.reissue(user.sessionId());
		return ResponseEntity.noContent()
				.cacheControl(CacheControl.noStore())
				.header(HttpHeaders.SET_COOKIE, cookies.write(renewed))
				.build();
	}

	@PutMapping("/onboarding/email")
	@Tag(name = "p02-onboarding")
	@Operation(operationId = "saveOnboardingEmail")
	@DeveloperOnly
	public ResponseEntity<Void> saveEmail(
			@AuthenticationPrincipal AuthenticatedUser user,
			@RequestBody OnboardingEmailRequest request) {
		accounts.saveEmail(user, request);
		return ResponseEntity.noContent().cacheControl(CacheControl.noStore()).build();
	}
}
