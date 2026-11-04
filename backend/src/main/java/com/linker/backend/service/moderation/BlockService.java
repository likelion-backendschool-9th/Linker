package com.linker.backend.service.moderation;

import java.time.Instant;
import java.util.List;

import com.linker.backend.dto.moderation.response.BlockView;
import com.linker.backend.entity.account.User;
import com.linker.backend.entity.account.UserStatus;
import com.linker.backend.entity.moderation.UserBlock;
import com.linker.backend.global.error.ApiException;
import com.linker.backend.repository.account.UserRepository;
import com.linker.backend.repository.moderation.BlockInserter;
import com.linker.backend.repository.moderation.UserBlockRepository;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * D2 freeze — {@code user_blocks} period contract for D (1:1 DM filter).
 *
 * <ul>
 *   <li>{@code POST /blocks} opens a period ({@code unblocked_at = null}); active pair is idempotent.</li>
 *   <li>{@code DELETE /blocks/{id}} closes the active period (sets {@code unblocked_at}); never deletes the row.</li>
 *   <li>Re-block after close inserts a new period; closed periods stay for history.</li>
 *   <li>DM visibility uses recipient-owned periods only: hide when
 *       {@code sender} is {@code blocked_id} and {@code message.created_at ∈ [created_at, unblocked_at)}.</li>
 *   <li>Team chat is exempt — callers must not use {@link #hidesDirectMessage} for team rooms.</li>
 *   <li>{@link #blockedEitherWay} is for current access (list/apply/start chat), not history.</li>
 * </ul>
 */
@Service
public class BlockService {

	private final UserRepository users;
	private final UserBlockRepository blocks;
	private final BlockInserter inserter;

	public BlockService(UserRepository users, UserBlockRepository blocks, BlockInserter inserter) {
		this.users = users;
		this.blocks = blocks;
		this.inserter = inserter;
	}

	@Transactional(readOnly = true)
	public List<BlockView> listActive(long blockerId) {
		return blocks.findActive(blockerId).stream()
				.flatMap(block -> users.findById(block.getBlockedId())
						.filter(user -> user.getStatus() != UserStatus.DELETED && user.getDeletedAt() == null)
						.map(blocked -> new BlockView(
								new BlockView.UserCard(blocked.getId(), blocked.getUsername(), blocked.visibleName()),
								block.getCreatedAt()
						))
						.stream())
				.toList();
	}

	public void block(long blockerId, long blockedId) {
		if (blockerId == blockedId) {
			throw new ApiException(400, "VALIDATION_ERROR", "자기 자신은 차단할 수 없어요");
		}
		User blocked = users.findById(blockedId)
				.filter(user -> user.getStatus() != UserStatus.DELETED && user.getDeletedAt() == null)
				.orElseThrow(() -> new ApiException(404, "NOT_FOUND", "사용자를 찾을 수 없어요"));
		if (blocked.getId() == null) {
			throw new ApiException(404, "NOT_FOUND", "사용자를 찾을 수 없어요");
		}
		if (blocks.existsByBlockerIdAndBlockedIdAndUnblockedAtIsNull(blockerId, blockedId)) {
			return;
		}
		inserter.insertActive(blockerId, blockedId);
	}

	@Transactional
	public void unblock(long blockerId, long blockedId) {
		UserBlock active = blocks.findByBlockerIdAndBlockedIdAndUnblockedAtIsNull(blockerId, blockedId)
				.orElseThrow(() -> new ApiException(404, "NOT_FOUND", "차단 중인 사용자가 아니에요"));
		active.close(Instant.now());
	}

	@Transactional(readOnly = true)
	public boolean blockedEitherWay(long firstUserId, long secondUserId) {
		return blocks.existsByBlockerIdAndBlockedIdAndUnblockedAtIsNull(firstUserId, secondUserId)
				|| blocks.existsByBlockerIdAndBlockedIdAndUnblockedAtIsNull(secondUserId, firstUserId);
	}

	/**
	 * Whether a 1:1 message from {@code senderId} at {@code messageCreatedAt} must stay invisible
	 * to {@code viewerId}. Uses every period the viewer owns (active and closed).
	 */
	@Transactional(readOnly = true)
	public boolean hidesDirectMessage(long viewerId, long senderId, Instant messageCreatedAt) {
		if (viewerId == senderId || messageCreatedAt == null) {
			return false;
		}
		return blocks.existsCovering(viewerId, senderId, messageCreatedAt);
	}
}
