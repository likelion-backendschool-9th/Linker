package com.linker.backend.repository.account;

import java.util.Optional;

import com.linker.backend.entity.account.GithubToken;

import org.springframework.data.jpa.repository.JpaRepository;

public interface GithubTokenRepository extends JpaRepository<GithubToken, Long> {

	Optional<GithubToken> findByUser_Id(Long userId);
}
