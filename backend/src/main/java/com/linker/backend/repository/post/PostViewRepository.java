package com.linker.backend.repository.post;

import java.time.LocalDate;
import java.util.Optional;

import com.linker.backend.entity.post.PostView;

import org.springframework.data.jpa.repository.JpaRepository;

public interface PostViewRepository extends JpaRepository<PostView, Long> {

	Optional<PostView> findByPostIdAndViewerIdAndViewDate(long postId, long viewerId, LocalDate viewDate);
}
