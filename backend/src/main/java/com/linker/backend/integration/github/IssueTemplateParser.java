package com.linker.backend.integration.github;

import com.linker.backend.dto.issue.response.IssueTemplateResponse;
import com.linker.backend.dto.issue.response.IssueTemplateResponse.Field;
import com.linker.backend.global.error.ApiException;
import java.util.*;
import org.springframework.stereotype.Component;
import org.yaml.snakeyaml.LoaderOptions;
import org.yaml.snakeyaml.Yaml;
import org.yaml.snakeyaml.constructor.SafeConstructor;

/** Parses data only: no YAML object construction, duplicate keys or unbounded aliases. */
@Component
public class IssueTemplateParser {
  public IssueTemplateResponse parse(String key, String file, String content, String source) {
    if (content.length() > 256_000) throw invalid();
    boolean markdown = file.toLowerCase(Locale.ROOT).endsWith(".md");
    String body = "";
    String yaml = content;
    if (markdown) {
      String normalized = content.replace("\r\n", "\n");
      if (!normalized.startsWith("---\n")) throw invalid();
      int end = normalized.indexOf("\n---", 4);
      if (end < 0) throw invalid();
      yaml = normalized.substring(4, end);
      body = normalized.substring(end + 4).strip();
    }
    var opts = new LoaderOptions();
    opts.setAllowDuplicateKeys(false);
    opts.setMaxAliasesForCollections(20);
    opts.setNestingDepthLimit(30);
    opts.setCodePointLimit(256_000);
    Object loaded = new Yaml(new SafeConstructor(opts)).load(yaml);
    Map<?, ?> meta = map(loaded);
    String name = text(meta, "name");
    if (name.isBlank()) throw invalid();
    List<Field> fields = new ArrayList<>();
    Set<String> ids = new HashSet<>();
    if (!markdown) {
      if (!(meta.get("body") instanceof List<?> elements) || elements.isEmpty()) throw invalid();
      int index = 0;
      for (Object element : elements) {
        Map<?, ?> row = map(element), attr = map(row.get("attributes"));
        String type = text(row, "type"), id = text(row, "id");
        if (id.isBlank()) id = "field-" + index;
        if (!ids.add(id)) throw invalid();
        index++;
        if (!Set.of("markdown", "input", "textarea", "dropdown", "checkboxes", "upload")
            .contains(type)) throw invalid();
        String label = text(attr, "label");
        if (!Set.of("markdown", "upload").contains(type) && label.isBlank()) throw invalid();
        List<String> options = new ArrayList<>();
        List<Integer> requiredOptions = new ArrayList<>();
        if (type.equals("checkboxes")) {
          if (!(attr.get("options") instanceof List<?> values)) throw invalid();
          for (Object option : values) {
            var o = map(option);
            String value = text(o, "label");
            if (value.isBlank()) throw invalid();
            if (Boolean.TRUE.equals(o.get("required"))) requiredOptions.add(options.size());
            options.add(value);
          }
        } else options.addAll(strings(attr.get("options")));
        if ((type.equals("dropdown") || type.equals("checkboxes")) && options.isEmpty())
          throw invalid();
        if (new HashSet<>(options).size() != options.size()) throw invalid();
        boolean required =
            row.get("validations") instanceof Map<?, ?> validation
                && Boolean.TRUE.equals(validation.get("required"));
        String value = text(attr, "value");
        List<String> defaults = new ArrayList<>();
        if (type.equals("dropdown") && attr.get("default") instanceof Number n) {
          int selected = n.intValue();
          if (selected < 0 || selected >= options.size()) throw invalid();
          value = options.get(selected);
          defaults.add(value);
        }
        if (type.equals("dropdown") && attr.get("default") instanceof List<?> selected) {
          if (!Boolean.TRUE.equals(attr.get("multiple"))) throw invalid();
          for (Object option : selected) {
            if (!(option instanceof Number n) || n.intValue() < 0 || n.intValue() >= options.size())
              throw invalid();
            defaults.add(options.get(n.intValue()));
          }
          if (new HashSet<>(defaults).size() != defaults.size()) throw invalid();
        }
        fields.add(
            new Field(
                id,
                type,
                label,
                text(attr, "description"),
                value,
                List.copyOf(options),
                List.copyOf(requiredOptions),
                required,
                Boolean.TRUE.equals(attr.get("multiple")),
                text(attr, "render"),
                List.copyOf(defaults),
                text(attr, "placeholder")));
      }
    }
    return new IssueTemplateResponse(
        key,
        name,
        text(meta, "about").isBlank() ? text(meta, "description") : text(meta, "about"),
        markdown ? "MARKDOWN" : "FORM",
        source,
        text(meta, "title"),
        body,
        List.copyOf(fields),
        strings(meta.get("labels")),
        strings(meta.get("assignees")),
        strings(meta.get("projects")),
        text(meta, "type"),
        false);
  }

  public String render(IssueTemplateResponse template, Map<String, List<String>> input) {
    if (!template.format().equals("FORM")) return template.body();
    var answers = input == null ? Map.<String, List<String>>of() : input;
    Set<String> allowed = new HashSet<>();
    template.fields().forEach(f -> allowed.add(f.id()));
    if (!allowed.containsAll(answers.keySet())) throw invalid();
    StringBuilder result = new StringBuilder();
    for (var field : template.fields()) {
      if (field.type().equals("markdown") || field.type().equals("upload")) continue;
      List<String> values = answers.get(field.id());
      if (values == null)
        values =
            !field.defaultValues().isEmpty()
                ? field.defaultValues()
                : field.value().isBlank() ? List.of() : List.of(field.value());
      if (values.stream().anyMatch(Objects::isNull)) throw invalid();
      if (new HashSet<>(values).size() != values.size()) throw invalid();
      boolean empty = values.isEmpty() || values.stream().allMatch(String::isBlank);
      if (field.required() && empty) throw invalid();
      if (field.type().equals("dropdown") || field.type().equals("checkboxes")) {
        if (!field.options().containsAll(values)) throw invalid();
        if (!field.multiple() && field.type().equals("dropdown") && values.size() > 1)
          throw invalid();
        for (int i : field.requiredOptions())
          if (!values.contains(field.options().get(i))) throw invalid();
      } else if (values.size() > 1) throw invalid();
      String answer = empty ? "_No response_" : String.join(", ", values);
      if (field.type().equals("checkboxes")) {
        var checked = values;
        answer =
            String.join(
                "\n",
                field.options().stream()
                    .map(o -> "- [" + (checked.contains(o) ? "X" : " ") + "] " + o)
                    .toList());
      } else if (!empty && !field.render().isBlank()) {
        // Longer fence keeps a user's embedded backticks inside the code block.
        int longest =
            Arrays.stream(answer.split("[^`]+", -1)).mapToInt(String::length).max().orElse(0);
        String fence = "`".repeat(Math.max(3, longest + 1));
        answer =
            fence
                + field.render().replaceAll("[^a-zA-Z0-9_+.-]", "")
                + "\n"
                + answer
                + "\n"
                + fence;
      }
      if (!result.isEmpty()) result.append("\n\n");
      result.append("### ").append(field.label().replace('\n', ' ')).append("\n\n").append(answer);
    }
    return result.toString();
  }

  private static Map<?, ?> map(Object value) {
    if (value instanceof Map<?, ?> m) return m;
    throw invalid();
  }

  private static String text(Map<?, ?> m, String key) {
    Object v = m.get(key);
    return v == null ? "" : v.toString();
  }

  private static List<String> strings(Object v) {
    if (v == null) return List.of();
    List<String> values =
        v instanceof List<?> l
            ? l.stream()
                .map(
                    x -> {
                      if (!(x instanceof String)) throw invalid();
                      return (String) x;
                    })
                .toList()
            : v instanceof String s ? Arrays.asList(s.split(",")) : null;
    if (values == null) throw invalid();
    return values.stream().map(String::strip).filter(s -> !s.isEmpty()).toList();
  }

  public static ApiException invalid() {
    return new ApiException(400, "VALIDATION_ERROR", "템플릿 입력을 확인해 주세요");
  }
}
