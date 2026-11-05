package com.linker.backend.dto.team.request;

/** Repeated POST without retry returns progress; retry=true restarts a failed job explicitly. */
public record CompleteTeamSetupRequest(boolean retry) {}
