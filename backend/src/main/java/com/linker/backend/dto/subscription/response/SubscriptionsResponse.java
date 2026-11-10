package com.linker.backend.dto.subscription.response;

import static io.swagger.v3.oas.annotations.media.Schema.RequiredMode.REQUIRED;

import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;

public record SubscriptionsResponse(
		@Schema(requiredMode = REQUIRED, description = "Running subscriptions; empty means the free plan") List<SubscriptionItemResponse> items
) {
}
