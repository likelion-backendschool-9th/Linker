package com.linker.backend.entity.team.type;

import java.util.Locale;

/**
 * GitHub Projects {@code ProjectV2SingleSelectFieldOptionColor}. Hex is never stored; UI maps these
 * enums to design tokens. Linker-created boards keep Todo=GRAY, In Progress=BLUE, Blocked=RED,
 * Done=GREEN.
 */
public enum BoardStatusColor {
	BLUE,
	GRAY,
	GREEN,
	ORANGE,
	PINK,
	PURPLE,
	RED,
	YELLOW;

	/** Unknown / blank GitHub values fall back to GRAY (also NONE / OTHER display). */
	public static BoardStatusColor parse(String raw) {
		if (raw == null || raw.isBlank()) return GRAY;
		try {
			return BoardStatusColor.valueOf(raw.trim().toUpperCase(Locale.ROOT));
		} catch (IllegalArgumentException ignored) {
			return GRAY;
		}
	}
}
