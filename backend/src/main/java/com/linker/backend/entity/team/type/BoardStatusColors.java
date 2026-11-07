package com.linker.backend.entity.team.type;

import java.util.EnumMap;
import java.util.List;
import java.util.Map;

/**
 * Resolves issue/board display colors from {@code board_status_mappings} (SoT). Not a role service.
 *
 * <p>Exceptions (fixed): {@code NONE} and {@code OTHER} → {@link BoardStatusColor#GRAY}. GitHub
 * option color changes after link are out of scope until the board is re-linked.
 */
public final class BoardStatusColors {
	private BoardStatusColors() {}

	public static Map<BoardStatus, BoardStatusColor> byLinkerStatus(
			List<? extends ColoredMapping> mappings) {
		Map<BoardStatus, BoardStatusColor> colors = new EnumMap<>(BoardStatus.class);
		for (var mapping : mappings) {
			BoardStatus status = mapping.linkerStatus();
			if (status == BoardStatus.TODO
					|| status == BoardStatus.IN_PROGRESS
					|| status == BoardStatus.BLOCKED
					|| status == BoardStatus.DONE) {
				colors.putIfAbsent(status, mapping.color());
			}
		}
		return Map.copyOf(colors);
	}

	/** Effective list/detail status after closed→DONE, then mapping lookup. */
	public static BoardStatusColor forStatus(
			String effectiveStatus, Map<BoardStatus, BoardStatusColor> byLinkerStatus) {
		if (effectiveStatus == null
				|| "NONE".equals(effectiveStatus)
				|| "OTHER".equals(effectiveStatus)) {
			return BoardStatusColor.GRAY;
		}
		try {
			return byLinkerStatus.getOrDefault(
					BoardStatus.valueOf(effectiveStatus), BoardStatusColor.GRAY);
		} catch (IllegalArgumentException ignored) {
			return BoardStatusColor.GRAY;
		}
	}

	public interface ColoredMapping {
		BoardStatus linkerStatus();

		BoardStatusColor color();
	}
}
