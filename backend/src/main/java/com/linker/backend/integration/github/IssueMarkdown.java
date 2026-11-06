package com.linker.backend.integration.github;

import java.util.Locale;
import org.commonmark.node.AbstractVisitor;
import org.commonmark.node.HtmlBlock;
import org.commonmark.node.HtmlInline;
import org.commonmark.node.Image;
import org.commonmark.node.Link;
import org.commonmark.node.Paragraph;
import org.commonmark.node.Text;
import org.commonmark.parser.Parser;
import org.commonmark.renderer.markdown.MarkdownRenderer;

/** Returns Markdown, not HTML. Consumers must retain their safe Markdown renderer. */
public final class IssueMarkdown {
  private IssueMarkdown() {}

  public static String sanitize(String markdown) {
    if (markdown == null || markdown.isEmpty()) return "";
    var root = Parser.builder().build().parse(markdown == null ? "" : markdown);
    root.accept(
        new AbstractVisitor() {
          @Override
          public void visit(HtmlInline n) {
            n.insertBefore(new Text(n.getLiteral()));
            n.unlink();
          }

          @Override
          public void visit(HtmlBlock n) {
            var p = new Paragraph();
            p.appendChild(new Text(n.getLiteral()));
            n.insertBefore(p);
            n.unlink();
          }

          @Override
          public void visit(Link n) {
            if (!safe(n.getDestination())) n.setDestination("");
            visitChildren(n);
          }

          @Override
          public void visit(Image n) {
            if (!safe(n.getDestination())) n.setDestination("");
            visitChildren(n);
          }
        });
    return MarkdownRenderer.builder().build().render(root);
  }

  private static boolean safe(String url) {
    String value = url.replaceAll("[\\p{Cntrl}\\s]", "").toLowerCase(Locale.ROOT);
    return !value.contains(":")
        || value.startsWith("https:")
        || value.startsWith("http:")
        || value.startsWith("mailto:");
  }
}
