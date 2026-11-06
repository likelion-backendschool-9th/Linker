package com.linker.backend.dto.notification.response;

import java.util.List;

public record NotificationPageResponse(List<NotificationItemResponse> items, String nextCursor) {
}
