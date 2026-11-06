package com.linker.backend.dto.issue.response;

import java.util.List;

public record IssueTemplateResponse(
    String key,
    String name,
    String description,
    String format,
    String source,
    String title,
    String body,
    List<Field> fields,
    List<String> labels,
    List<String> assignees,
    List<String> projects,
    String issueType,
    boolean fallback) {
  public record Field(
      String id,
      String type,
      String label,
      String description,
      String value,
      List<String> options,
      List<Integer> requiredOptions,
      boolean required,
      boolean multiple,
      String render,
      List<String> defaultValues,
      String placeholder) {}

  public record Choice(String key, String name, String description, String format, String source) {}

  public record ListResponse(
      List<Choice> templates,
      List<IssueDetailResponse.Person> assigneeCandidates,
      List<com.linker.backend.integration.github.IssueSource.Label> labelOptions,
      int maxAssignees) {}
}
