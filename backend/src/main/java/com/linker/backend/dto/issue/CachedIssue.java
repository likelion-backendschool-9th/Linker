package com.linker.backend.dto.issue;

/** Internal repository projection. Linker id is distinct from the snapshot's GitHub id/number. */
public record CachedIssue(long id, IssueCacheSnapshot snapshot) { }
