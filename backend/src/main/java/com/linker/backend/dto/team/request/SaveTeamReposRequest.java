package com.linker.backend.dto.team.request;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import java.util.List;

/** IDs are verified GitHub repository IDs, not untrusted local cache ids. */
public record SaveTeamReposRequest(@NotNull List<@NotNull @Positive Long> repoIds) {}
