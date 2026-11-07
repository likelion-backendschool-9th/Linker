package com.linker.backend.dto.account.response;

import java.time.Instant;

/** Internal DB facts, not a session/JWT or HTTP contract. A restricted null end is permanent. */
public record AccountSanctionState(boolean restricted, Instant until, boolean revokedCurrent) {}
