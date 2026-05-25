from __future__ import annotations

import json
import re
from pathlib import Path

from docx import Document


DOCX_PATH = Path(r"C:\Users\kchuk\Downloads\fos_gia_vo_bak_09_03_02_rsob (2).docx")
OUT_PATH = Path(r"C:\Users\kchuk\OneDrive\Dokumente\Сайт\data\questions.json")

DISCIPLINES = [
    "Безопасность операционных систем и баз данных",
    "Информационный менеджмент",
    "Разработка web-приложений на языке JavaScript",
    "Разработка серверных приложений для WEB",
    "Реинжиниринг бизнес-процессов",
]

SECTIONS = [
    ("Задания закрытого типа", "single_choice"),
    ("Задания на последовательность и установление соответствия", "matching_or_order"),
    ("Задания открытого типа", "open"),
]


def normalize_space(value: str) -> str:
    return re.sub(r"\s+", " ", value.replace("\xad", "")).strip()


def split_lines(value: str) -> list[str]:
    parts = []
    for raw in value.replace("\r", "\n").split("\n"):
        text = normalize_space(raw)
        if text:
            parts.append(text)
    return parts


def clean_question_text(value: str) -> str:
    text = normalize_space(" ".join(split_lines(value)))
    if not text:
        return ""

    replace_if_tail = [
        r"^выберите правильный вариант ответа\s*:\s*(.+)$",
        r"^установите соответствие\s*:\s*(.+)$",
        r"^поставьте в соответствие\s*:\s*(.+)$",
        r"^определите последовательность\s*:\s*(.+)$",
        r"^упорядочьте\s*:\s*(.+)$",
    ]
    for pattern in replace_if_tail:
        match = re.match(pattern, text, flags=re.IGNORECASE)
        if match:
            text = normalize_space(match.group(1))
            break
    return text


def extract_options(value: str) -> list[str]:
    lines = split_lines(value)
    if len(lines) <= 1:
        return lines
    return lines


def extract() -> dict:
    document = Document(str(DOCX_PATH))
    tables = document.tables
    if len(tables) < 17:
        raise RuntimeError(f"Ожидалось минимум 17 таблиц, найдено {len(tables)}")

    questions = []
    qid = 1
    table_index = 2

    for discipline in DISCIPLINES:
        for section_name, qtype in SECTIONS:
            table = tables[table_index]
            table_index += 1

            for row in table.rows[1:]:
                cells = [cell.text.replace("\xad", "").strip() for cell in row.cells]
                if len(cells) < 3:
                    continue

                question_raw = cells[1] if len(cells) > 1 else ""
                answer_raw = normalize_space(cells[-1]) if cells else ""

                question_text = clean_question_text(question_raw)
                if not question_text:
                    continue

                options = []
                if qtype != "open" and len(cells) >= 4:
                    options = extract_options(cells[2])

                questions.append(
                    {
                        "id": qid,
                        "block": discipline,
                        "section": section_name,
                        "type": qtype,
                        "question": question_text,
                        "options": options,
                        "correctAnswer": answer_raw,
                    }
                )
                qid += 1

    return {
        "meta": {
            "source": str(DOCX_PATH),
            "totalQuestions": len(questions),
            "blocks": len(DISCIPLINES),
            "sectionsPerBlock": len(SECTIONS),
        },
        "questions": questions,
    }


def main() -> None:
    payload = extract()
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Saved {payload['meta']['totalQuestions']} questions to {OUT_PATH}")


if __name__ == "__main__":
    main()
