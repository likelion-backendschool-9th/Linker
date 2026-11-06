package com.linker.backend.dto.team.request;

import jakarta.validation.constraints.NotNull;
import java.util.Map;

/** Mapping keys are actual GitHub option IDs; display names are not identifiers. */
public record SetupBoardRequest(
    @NotNull Mode mode, String boardId, Map<String, String> statusMapping) {
  public enum Mode {
    NEW,
    EXISTING
  }
}
