package com.linker.backend.repository.account;

import java.util.Optional;

import com.linker.backend.entity.account.RecruiterProfile;

import org.springframework.data.jpa.repository.JpaRepository;

public interface RecruiterProfileRepository extends JpaRepository<RecruiterProfile, Long> {

	Optional<RecruiterProfile> findByUser_Id(Long userId);
}
