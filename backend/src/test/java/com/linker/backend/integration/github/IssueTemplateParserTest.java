package com.linker.backend.integration.github;

import static org.assertj.core.api.Assertions.*;

import java.util.*;
import org.junit.jupiter.api.Test;

class IssueTemplateParserTest {
  final IssueTemplateParser parser = new IssueTemplateParser();
  private static final String FORM =
      """
name: 버그
labels: [bug]
assignees: kim
projects: [acme/12]
type: Bug
body:
  - type: markdown
    attributes:
      value: 안내만 표시합니다
  - type: input
    id: symptom
    attributes:
      label: 증상
    validations:
      required: true
  - type: textarea
    id: detail
    attributes:
      label: 상세
  - type: dropdown
    id: platform
    attributes:
      label: 환경
      options: [Web, Mobile]
      default: 0
  - type: checkboxes
    id: consent
    attributes:
      label: 확인
      options:
        - label: 재현했습니다
          required: true
        - label: 추가 로그
""";

  @Test
  void parsesMetadataAndRendersGithubBody() {
    var t = parser.parse("repo:a", "bug.yml", FORM, "REPOSITORY");
    assertThat(t.labels()).containsExactly("bug");
    assertThat(t.assignees()).containsExactly("kim");
    assertThat(t.projects()).containsExactly("acme/12");
    assertThat(t.issueType()).isEqualTo("Bug");
    String body =
        parser.render(t, Map.of("symptom", List.of("로그인 실패"), "consent", List.of("재현했습니다")));
    assertThat(body)
        .contains(
            "### 증상\n\n로그인 실패",
            "### 상세\n\n_No response_",
            "### 환경\n\nWeb",
            "- [X] 재현했습니다",
            "- [ ] 추가 로그")
        .doesNotContain("안내만 표시합니다");
  }

  @Test
  void requiredFieldAndCheckboxAreEnforced() {
    var t = parser.parse("a", "a.yml", FORM, "REPOSITORY");
    assertThatThrownBy(() -> parser.render(t, Map.of())).isInstanceOf(RuntimeException.class);
    assertThatThrownBy(() -> parser.render(t, Map.of("symptom", List.of("오류"))))
        .isInstanceOf(RuntimeException.class);
  }

  @Test
  void unknownOrInventedOptionsAreRejected() {
    var t = parser.parse("a", "a.yml", FORM, "REPOSITORY");
    assertThatThrownBy(() -> parser.render(t, Map.of("unknown", List.of("값"))))
        .isInstanceOf(RuntimeException.class);
    assertThatThrownBy(
            () ->
                parser.render(
                    t,
                    Map.of(
                        "symptom",
                        List.of("오류"),
                        "platform",
                        List.of("invented"),
                        "consent",
                        List.of("재현했습니다"))))
        .isInstanceOf(RuntimeException.class);
  }

  @Test
  void markdownFrontmatterIsNotSentAsBody() {
    var t =
        parser.parse(
            "a",
            "bug.md",
            "---\nname: 버그\nabout: 설명\nlabels: bug, triage\ntitle: '[Bug] '\n---\n### 내용\n",
            "REPOSITORY");
    assertThat(t.body()).isEqualTo("### 내용");
    assertThat(t.labels()).containsExactly("bug", "triage");
  }

  @Test
  void maliciousTagsAndDuplicateYamlKeysAreRejected() {
    for (String text :
        List.of("!!java.net.URL [https://example.com]", "name: first\nname: second\nbody: []"))
      assertThatThrownBy(() -> parser.parse("a", "a.yml", text, "REPOSITORY"))
          .isInstanceOf(RuntimeException.class);
  }

  @Test
  void duplicateFormIdsAndUnrecognizedTypesAreRejected() {
    assertThatThrownBy(
            () ->
                parser.parse("a", "a.yml", FORM.replace("id: detail", "id: symptom"), "REPOSITORY"))
        .isInstanceOf(RuntimeException.class);
    assertThatThrownBy(
            () ->
                parser.parse(
                    "a", "a.yml", FORM.replace("type: input", "type: execute"), "REPOSITORY"))
        .isInstanceOf(RuntimeException.class);
  }

  @Test
  void multipleDropdownDefaultsAreRenderedAndRequiredChoicesRemainValidated() {
    String definition =
        FORM.replace("options: [Web, Mobile]", "options: [Web, Mobile]\n      multiple: true")
            .replace("default: 0", "default: [0, 1]");
    var template = parser.parse("a", "a.yml", definition, "REPOSITORY");
    assertThat(
            parser.render(template, Map.of("symptom", List.of("오류"), "consent", List.of("재현했습니다"))))
        .contains("### 환경\n\nWeb, Mobile");
  }
}
