package com.linker.backend.repository.profile;

import java.time.Instant;
import java.util.Collection;
import java.util.List;

import com.linker.backend.entity.profile.Follow;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

public interface FollowRepository extends JpaRepository<Follow, Long> {

	boolean existsByFollower_IdAndFollowing_Id(long followerId, long followingId);

	long countByFollower_Id(long followerId);

	long countByFollowing_Id(long followingId);

	long countByFollower_IdAndCreatedAtGreaterThanEqual(long followerId, Instant createdAt);

	@Query("select follow.following.id from Follow follow where follow.follower.id = :viewerId and follow.following.id in :userIds")
	List<Long> findFollowedIds(long viewerId, Collection<Long> userIds);

	@Query("""
			select follow from Follow follow
			join fetch follow.follower
			where follow.following.id = :userId
			order by follow.id desc
			""")
	List<Follow> followersFirst(long userId, Pageable pageable);

	@Query("""
			select follow from Follow follow
			join fetch follow.follower
			where follow.following.id = :userId and follow.id < :cursor
			order by follow.id desc
			""")
	List<Follow> followersBefore(long userId, long cursor, Pageable pageable);

	@Query("""
			select follow from Follow follow
			join fetch follow.following
			where follow.follower.id = :userId
			order by follow.id desc
			""")
	List<Follow> followingsFirst(long userId, Pageable pageable);

	@Query("""
			select follow from Follow follow
			join fetch follow.following
			where follow.follower.id = :userId and follow.id < :cursor
			order by follow.id desc
			""")
	List<Follow> followingsBefore(long userId, long cursor, Pageable pageable);

	@Modifying(clearAutomatically = true)
	@Query("""
			delete from Follow follow
			where (follow.follower.id = :firstUserId and follow.following.id = :secondUserId)
			   or (follow.follower.id = :secondUserId and follow.following.id = :firstUserId)
			""")
	void deleteBetween(long firstUserId, long secondUserId);

	@Modifying(clearAutomatically = true)
	@Query("delete from Follow follow where follow.follower.id = :followerId and follow.following.id = :followingId")
	void deletePair(long followerId, long followingId);
}
