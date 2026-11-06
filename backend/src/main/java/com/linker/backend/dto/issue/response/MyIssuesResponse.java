package com.linker.backend.dto.issue.response;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;

/**
 * Page 07 "내 이슈" (WBS 07, Policy POL-I-5): open issues assigned to me in one selected team, by
 * due urgency. The whole list is returned; the workspace preview limits rows in the UI. Items are
 * the page 11 card ({@code IssueListItem}).
 */
@Schema(requiredProperties = {"teamId", "items"})
public record MyIssuesResponse(long teamId, List<IssueListResponse.Item> items) {}
