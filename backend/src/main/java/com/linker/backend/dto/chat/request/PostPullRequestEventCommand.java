package com.linker.backend.dto.chat.request;

/** Internal B → D same-group command. No REST/STOMP send endpoint accepts this command. */
public record PostPullRequestEventCommand(long teamId, String deliveryKey, long repoId,
    long githubRepoId, long githubPrId, String repo, int prNumber, String title,
    String event, String url) {}
