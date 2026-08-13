// AI providers (Gemini, Mistral) commonly return markdown-formatted prose
// (**bold**, *italic*, `code`, # headings, bullet markers) even for plain
// summaries/suggestions. None of the surfaces that display this text are
// markdown renderers — they're plain <p>/<span> elements — so without this,
// the formatting marks show up as literal asterisks/hashes/backticks
// instead of actually being clean prose.
export function stripMarkdown(text: string): string {
  return text
    // Bold/italic/strikethrough: **x**, __x__, *x*, _x_, ~~x~~ -> x
    .replace(/(\*\*\*|___)(.*?)\1/g, '$2')
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(\*|_)(.*?)\1/g, '$2')
    .replace(/~~(.*?)~~/g, '$1')
    // Inline code and code fences
    .replace(/```[\s\S]*?```/g, (block) => block.replace(/```/g, '').trim())
    .replace(/`([^`]+)`/g, '$1')
    // Headings: "## Title" -> "Title"
    .replace(/^#{1,6}\s+/gm, '')
    // Bullet/numbered list markers at line start
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    // Markdown links: [text](url) -> text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .trim()
}
