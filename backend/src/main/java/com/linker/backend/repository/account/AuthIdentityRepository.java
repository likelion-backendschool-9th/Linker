package com.linker.backend.repository.account;

import java.util.Optional;

import com.linker.backend.entity.account.AuthIdentity;
import com.linker.backend.entity.account.type.AuthProvider;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AuthIdentityRepository extends JpaRepository<AuthIdentity, Long> {
  @Query("select distinct i.user from AuthIdentity i where i.provider='GITHUB' and (lower(i.providerLogin)=lower(:login) or lower(i.user.username)=lower(:login))")
  java.util.List<com.linker.backend.entity.account.User> findGithubUsersByLogin(String login);


  interface GithubLogin { Long getUserId(); String getLogin(); }
  @Query("select i.user.id as userId,i.providerLogin as login from AuthIdentity i where i.provider='GITHUB' and i.user.id in :userIds")
  java.util.List<GithubLogin> findGithubLogins(java.util.Collection<Long> userIds);

  @Query("select i.providerLogin from AuthIdentity i where i.user.id=:userId and i.provider='GITHUB'")
  Optional<String> findGithubLogin(long userId);

	@Query("select i.providerUserId from AuthIdentity i where i.user.id=:userId and i.provider='GITHUB'")
	Optional<String> findGithubUserId(long userId);

	@Query("""
			select identity from AuthIdentity identity
			join fetch identity.user
			where identity.provider = :provider
			  and identity.providerUserId = :providerUserId
			""")
	Optional<AuthIdentity> findByProviderAndProviderUserId(
			@Param("provider") AuthProvider provider,
			@Param("providerUserId") String providerUserId);

	@Query("""
			select identity from AuthIdentity identity
			join fetch identity.user
			where identity.user.id = :userId
			  and identity.provider = :provider
			""")
	Optional<AuthIdentity> findByUserIdAndProvider(
			@Param("userId") long userId,
			@Param("provider") AuthProvider provider);
}
