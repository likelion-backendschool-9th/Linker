package com.linker.backend.repository.github;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.linker.backend.global.error.ApiException;
import jakarta.persistence.EntityManagerFactory;
import jakarta.persistence.PersistenceException;
import java.sql.Connection;
import org.hibernate.ConnectionAcquisitionMode;
import org.hibernate.ConnectionReleaseMode;
import org.hibernate.Session;
import org.hibernate.SessionBuilder;
import org.hibernate.SessionFactory;
import org.hibernate.jdbc.Work;
import org.hibernate.query.NativeQuery;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class GithubWebhookDeliveryRepositoryImplTest {
	final EntityManagerFactory factory = mock(EntityManagerFactory.class);
	final SessionFactory sessions = mock(SessionFactory.class);
	final SessionBuilder builder = mock(SessionBuilder.class);
	final Session session = mock(Session.class);
	final Connection connection = mock(Connection.class);
	final NativeQuery<Boolean> acquire = mock(NativeQuery.class);
	final NativeQuery<Boolean> release = mock(NativeQuery.class);
	final GithubWebhookDeliveryRepositoryImpl repository = new GithubWebhookDeliveryRepositoryImpl(factory);

	@BeforeEach
	void prepare() {
		when(factory.unwrap(SessionFactory.class)).thenReturn(sessions);
		when(sessions.withOptions()).thenReturn(builder);
		when(builder.connectionHandling(ConnectionAcquisitionMode.AS_NEEDED, ConnectionReleaseMode.ON_CLOSE)).thenReturn(builder);
		when(builder.openSession()).thenReturn(session);
		when(session.createNativeQuery("select pg_try_advisory_lock(:key)", Boolean.class)).thenReturn(acquire);
		when(session.createNativeQuery("select pg_advisory_unlock(:key)", Boolean.class)).thenReturn(release);
		when(acquire.setParameter("key", -42L)).thenReturn(acquire);
		when(release.setParameter("key", -42L)).thenReturn(release);
		when(acquire.getSingleResult()).thenReturn(true);
		when(release.getSingleResult()).thenReturn(true);
		doAnswer(call -> { call.<Work>getArgument(0).execute(connection); return null; }).when(session).doWork(any());
	}

	@Test
	void invalidIdsNeverAcquireAConnectionOrInvokeWork() {
		Runnable work = mock(Runnable.class);
		repository.withDispatchLock(0, work);
		repository.withDispatchLock(-1, work);
		verifyNoInteractions(factory, work);
	}

	@Test
	void contentionSkipsTheHandlerAndClosesTheUnownedSession() {
		when(acquire.getSingleResult()).thenReturn(false);
		Runnable work = mock(Runnable.class);
		repository.withDispatchLock(42, work);
		verifyNoInteractions(work, release);
		verify(session).close();
	}

	@Test
	void failedUnlockDiscardsTheConnectionInsteadOfReturningALockToThePool() throws Exception {
		when(release.getSingleResult()).thenReturn(false);
		assertThatThrownBy(() -> repository.withDispatchLock(42, () -> {}))
				.isInstanceOf(IllegalStateException.class).hasMessage("Webhook dispatch lock unavailable");
		verify(connection).setAutoCommit(true);
		verify(connection).abort(any());
		verify(session).close();
	}

	@Test
	void releaseAndCloseFailuresNeverReplaceTheHandlerFailure() throws Exception {
		when(release.getSingleResult()).thenThrow(new PersistenceException("synthetic unlock failure"));
		doThrow(new PersistenceException("synthetic close failure")).when(session).close();
		var original = new ApiException(409, "STATE_CONFLICT", "synthetic handler failure");
		assertThatThrownBy(() -> repository.withDispatchLock(42, () -> { throw original; }))
				.isSameAs(original).satisfies(error -> assertThat(error.getSuppressed()).hasSize(2));
		verify(connection).abort(any());
	}

	@Test
	void providerExceptionsFromTheHandlerPassThroughInsteadOfBecomingLockFailures() {
		var original = new PersistenceException("synthetic handler persistence failure");
		assertThatThrownBy(() -> repository.withDispatchLock(42, () -> { throw original; })).isSameAs(original);
		verify(release).getSingleResult();
		verify(session).close();
	}

	@Test
	void anErrorAlsoReleasesTheLockAndClosesTheSession() {
		var original = new AssertionError("synthetic handler error");
		assertThatThrownBy(() -> repository.withDispatchLock(42, () -> { throw original; })).isSameAs(original);
		verify(release).getSingleResult();
		verify(session).close();
	}

	@Test
	void acquisitionFailuresUseASanitizedMessageAndCloseTheSession() throws Exception {
		when(acquire.getSingleResult()).thenThrow(new PersistenceException("synthetic connection detail"));
		Runnable work = mock(Runnable.class);
		assertThatThrownBy(() -> repository.withDispatchLock(42, work))
				.isInstanceOf(IllegalStateException.class).hasMessage("Webhook dispatch lock unavailable").hasNoCause();
		verifyNoInteractions(work, release);
		verify(connection).abort(any());
		verify(session).close();
	}
}
