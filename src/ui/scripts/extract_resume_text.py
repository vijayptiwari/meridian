import json
import pathlib
import sys


def read_pdf(file_path: pathlib.Path) -> str:
    from pypdf import PdfReader

    reader = PdfReader(str(file_path))
    pages = []
    for page in reader.pages:
        try:
            pages.append(page.extract_text() or "")
        except Exception:
            pages.append("")
    return "\n".join(pages)


def read_docx(file_path: pathlib.Path) -> str:
    from docx import Document

    document = Document(str(file_path))
    lines = []
    for paragraph in document.paragraphs:
      lines.append(paragraph.text)
    return "\n".join(lines)


def read_text(file_path: pathlib.Path) -> str:
    return file_path.read_text(encoding="utf-8", errors="ignore")


def main() -> None:
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Missing file path."}))
        sys.exit(1)

    file_path = pathlib.Path(sys.argv[1]).resolve()
    if not file_path.exists():
        print(json.dumps({"error": f"File not found: {file_path}"}))
        sys.exit(1)

    suffix = file_path.suffix.lower()
    if suffix == ".pdf":
        text = read_pdf(file_path)
    elif suffix == ".docx":
        text = read_docx(file_path)
    elif suffix in {".txt", ".md"}:
        text = read_text(file_path)
    else:
        print(json.dumps({"error": f"Unsupported file type: {suffix}"}))
        sys.exit(1)

    print(
        json.dumps(
            {
                "filePath": str(file_path),
                "text": text,
            }
        )
    )


if __name__ == "__main__":
    main()
