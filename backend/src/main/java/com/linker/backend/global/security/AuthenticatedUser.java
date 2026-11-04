package com.linker.backend.global.security;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;

import com.linker.backend.entity.account.UserStatus;
import com.linker.backend.entity.account.UserType;

import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

public record AuthenticatedUser(
		long userId,
		String login,
		UserType userType,
		UserStatus status,
		Instant suspendedUntil,
		boolean adminRegistered,
		boolean operatorAuthorized,
		boolean onboarded,
		long sessionId
) implements UserDetails {

	@Override
	public Collection<? extends GrantedAuthority> getAuthorities() {
		List<GrantedAuthority> authorities = new ArrayList<>();
		authorities.add(new SimpleGrantedAuthority(Authorities.USER));
		if (userType == UserType.DEVELOPER) {
			authorities.add(new SimpleGrantedAuthority(Authorities.DEVELOPER));
		}
		if (userType == UserType.RECRUITER) {
			authorities.add(new SimpleGrantedAuthority(Authorities.RECRUITER));
		}
		if (operatorAuthorized) {
			authorities.add(new SimpleGrantedAuthority(Authorities.ADMIN));
		}
		return List.copyOf(authorities);
	}

	@Override
	public String getPassword() {
		return null;
	}

	@Override
	public String getUsername() {
		return login;
	}

	@Override
	public boolean isAccountNonExpired() {
		return status != UserStatus.DELETED;
	}

	@Override
	public boolean isAccountNonLocked() {
		return true;
	}

	@Override
	public boolean isCredentialsNonExpired() {
		return true;
	}

	@Override
	public boolean isEnabled() {
		return status != UserStatus.DELETED;
	}
}
