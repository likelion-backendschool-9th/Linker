package com.linker.backend.dto.stats.response;

import com.linker.backend.entity.post.type.PostViewSource;
import java.time.LocalDate;

/** Internal grouped row; never includes a visitor identifier. */
public record PostViewBucket(long postId,LocalDate day,PostViewSource source,long views,long readmeExpands) {}
