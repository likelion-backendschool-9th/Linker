package com.linker.backend.dto.chat.response;

import java.time.Instant;
import java.util.List;

import com.fasterxml.jackson.annotation.JsonProperty;

public final class RecruiterOfferResponses {

	private RecruiterOfferResponses() {
	}

	public record OfferList(List<OfferItem> items, String nextCursor) {
	}

	public record OfferItem(
			long roomId,
			String status,
			Developer developer,
			boolean unavailable,
			List<String> techStack,
			String firstMessage,
			Instant sentAt
	) {
	}

	public record Developer(
			long id,
			String login,
			String name,
			String avatarUrl,
			String userType,
			String jobStatus
	) {
	}

	public record OfferCounts(
			@JsonProperty("TALKING") int talking,
			@JsonProperty("WAITING") int waiting,
			@JsonProperty("NO_RESPONSE") int noResponse
	) {
	}

	public record OfferSummary(
			int talkingCount,
			int waitingCount,
			int todayUsed,
			int todayLimit,
			int scoutTodayLimit,
			boolean scoutSubscribed,
			List<LatestOffer> latest
	) {
	}

	public record LatestOffer(long roomId, Developer developer, String status, Instant sentAt) {
	}

	public record FirstMessage(long roomId, String text, Instant sentAt) {
	}
}
