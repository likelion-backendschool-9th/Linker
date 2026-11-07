package com.linker.backend.dto.subscription.response;

/** Internal compatibility projection; not an HTTP response or an entitlement decision. */
public record SubscriptionSchemaView(boolean ready, boolean grace) {}
