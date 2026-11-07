package com.linker.backend.repository.post;

import java.time.LocalDate;
import java.util.Optional;

import com.linker.backend.entity.post.PostView;

import org.springframework.data.jpa.repository.JpaRepository;

public interface PostViewRepository extends JpaRepository<PostView, Long> {

  @org.springframework.data.jpa.repository.Query("""
      select new com.linker.backend.dto.stats.response.PostViewBucket(v.post.id,v.viewDate,v.source,
          count(v),sum(case when v.readmeExpanded=true then 1 else 0 end))
      from PostView v where v.post.author.id=:userId and v.post.deletedAt is null
          and v.viewer.id<>:userId and v.viewDate>=:from and v.viewDate<=:to
      group by v.post.id,v.viewDate,v.source
      """)
  java.util.List<com.linker.backend.dto.stats.response.PostViewBucket> findStatsBuckets(
      long userId,LocalDate from,LocalDate to);


	Optional<PostView> findByPostIdAndViewerIdAndViewDate(long postId, long viewerId, LocalDate viewDate);
}
