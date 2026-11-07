package com.linker.backend.repository.github;

import jakarta.persistence.EntityManagerFactory;
import jakarta.persistence.PersistenceException;
import org.hibernate.ConnectionAcquisitionMode;
import org.hibernate.ConnectionReleaseMode;
import org.hibernate.Session;
import org.hibernate.SessionFactory;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** Spring Data fragment. Lock ownership belongs to the delivery repository, not integration. */
public class GithubWebhookDeliveryRepositoryImpl implements GithubWebhookDeliveryRepositoryCustom {
	private final EntityManagerFactory factory;

	public GithubWebhookDeliveryRepositoryImpl(EntityManagerFactory factory) {
		this.factory = factory;
	}

	@Override
	@Transactional(propagation = Propagation.NEVER)
	public void withDispatchLock(long deliveryId, Runnable work) {
		if (deliveryId <= 0) return;
		Session session = openSession();
		Throwable failure = null;
		try {
			boolean held;
			try {
				session.doWork(connection -> connection.setAutoCommit(true));
				held = query(session, "select pg_try_advisory_lock(:key)", -deliveryId);
			}
			catch (PersistenceException exception) {
				// Acquisition may have succeeded on the server before its response failed.
				discard(session);
				throw unavailable();
			}
			if (!held) return;
			Throwable workFailure = null;
			try { work.run(); }
			catch (RuntimeException | Error exception) {
				workFailure = exception;
				throw exception;
			}
			finally { unlock(session, deliveryId, workFailure); }
		}
		catch (RuntimeException | Error exception) {
			failure = exception;
			throw exception;
		}
		finally {
			try { session.close(); }
			catch (RuntimeException exception) {
				if (failure == null) throw unavailable();
				failure.addSuppressed(unavailable());
			}
		}
	}

	private Session openSession() {
		try {
			// PostgreSQL advisory locks are session-scoped: retain ONE physical connection through
			// unlock. Independent Hibernate Session + autocommit keeps GitHub calls outside DB txs.
			// Keep the existing negative bigint key so old and new workers still serialize together.
			return factory.unwrap(SessionFactory.class).withOptions()
					.connectionHandling(ConnectionAcquisitionMode.AS_NEEDED, ConnectionReleaseMode.ON_CLOSE)
					.openSession();
		}
		catch (PersistenceException exception) { throw unavailable(); }
	}

	private void unlock(Session session, long deliveryId, Throwable workFailure) {
		try {
			if (!query(session, "select pg_advisory_unlock(:key)", -deliveryId)) throw unavailable();
		}
		catch (RuntimeException exception) {
			// A pooled connection must never retain this session lock after a failed unlock.
			discard(session);
			if (workFailure == null) throw unavailable();
			workFailure.addSuppressed(unavailable());
		}
	}

	private void discard(Session session) {
		try { session.doWork(connection -> connection.abort(Runnable::run)); }
		catch (RuntimeException ignored) { /* Preserve the original work/lock outcome. */ }
	}

	private boolean query(Session session, String sql, long key) {
		// Native: PostgreSQL session advisory locks cannot be expressed with JPQL or row locks.
		return Boolean.TRUE.equals(session.createNativeQuery(sql, Boolean.class)
				.setParameter("key", key).getSingleResult());
	}

	private static IllegalStateException unavailable() {
		// Keep connection/provider details out of the worker's failure message.
		return new IllegalStateException("Webhook dispatch lock unavailable");
	}
}
