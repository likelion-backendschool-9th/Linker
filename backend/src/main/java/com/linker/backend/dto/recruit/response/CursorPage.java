package com.linker.backend.dto.recruit.response;

import java.util.List;

public record CursorPage<T>(List<T> items, String nextCursor) {
}
