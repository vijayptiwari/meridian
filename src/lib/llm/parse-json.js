function extractJsonFromText(text) {
  const trimmed = String(text || "").trim();
  if (!trimmed) {
    return null;
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenceMatch) {
      try {
        return JSON.parse(fenceMatch[1].trim());
      } catch {
        return null;
      }
    }

    const start = trimmed.indexOf("{");
    const arrayStart = trimmed.indexOf("[");
    const index =
      start === -1 ? arrayStart : arrayStart === -1 ? start : Math.min(start, arrayStart);

    if (index >= 0) {
      try {
        return JSON.parse(trimmed.slice(index));
      } catch {
        return null;
      }
    }
  }

  return null;
}

module.exports = { extractJsonFromText };
