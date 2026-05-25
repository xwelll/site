from __future__ import annotations

import json
import re
from collections import Counter
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
QUESTIONS_PATH = ROOT / "data" / "questions.json"


def normalize_letters(value: str) -> str:
    value = (value or "").upper().replace("Ё", "Е")
    map_extra = {"À": "А", "Á": "Б", "Â": "В", "Ã": "Г", "Ä": "Д", "Å": "Е"}
    value = "".join(map_extra.get(ch, ch) for ch in value)
    map_latin = {"A": "А", "B": "Б", "C": "В", "D": "Г", "E": "Е"}
    value = "".join(map_latin.get(ch, ch) for ch in value)
    return value


def extract_letters(value: str) -> list[str]:
    return [ch for ch in normalize_letters(value) if "А" <= ch <= "Я"]


def split_option(raw: str, index: int) -> tuple[str, str]:
    text = (raw or "").strip()
    match = re.match(r"^\s*([A-Za-zА-Яа-яÀÁÂÃÄÅ])\s*[\).]\s*(.*)$", text)
    if match:
        label = extract_letters(match.group(1))
        label_value = label[0] if label else "АБВГДЕЖЗ"[index]
        return label_value, match.group(2).strip()
    return "АБВГДЕЖЗ"[index], text


def validate() -> int:
    payload = json.loads(QUESTIONS_PATH.read_text(encoding="utf-8"))
    questions = payload["questions"]
    issues: list[str] = []
    types = Counter(q["type"] for q in questions)

    for q in questions:
        base = f"ID {q['id']}"
        if not q.get("block") or not q.get("section") or not q.get("question"):
            issues.append(f"{base}: пустой block/section/question")

        if q["type"] == "single_choice":
            opts = q.get("options", [])
            if len(opts) < 2:
                issues.append(f"{base}: закрытый вопрос без достаточного числа вариантов")
                continue
            labels = [split_option(opt, i)[0] for i, opt in enumerate(opts)]
            if len(set(labels)) != len(labels):
                issues.append(f"{base}: дублируются метки вариантов {labels}")

            answer_letters = extract_letters(q.get("correctAnswer", ""))
            if not answer_letters:
                issues.append(f"{base}: нет распознанных букв в правильном ответе")
            else:
                wrong = [a for a in answer_letters if a not in labels]
                if wrong:
                    issues.append(f"{base}: ответ {answer_letters} вне диапазона опций {labels}")

        elif q["type"] == "matching_or_order":
            ans = normalize_letters(q.get("correctAnswer", ""))
            has_pairs = bool(re.search(r"\d+\s*[-=:.]?\s*[А-Я]", ans))
            has_sequence = len(extract_letters(ans)) >= 2
            if not (has_pairs or has_sequence):
                issues.append(f"{base}: не распознан формат ответа соответствия/последовательности")

        elif q["type"] == "open":
            if not q.get("correctAnswer"):
                issues.append(f"{base}: пустой ответ в открытом вопросе")
        else:
            issues.append(f"{base}: неизвестный тип {q['type']}")

    print(f"Файл: {QUESTIONS_PATH}")
    print(f"Всего вопросов: {len(questions)}")
    print(f"Типы: {dict(types)}")
    print(f"Проблем: {len(issues)}")
    for line in issues[:120]:
        print(" -", line)
    if len(issues) > 120:
        print(f" ...и еще {len(issues) - 120}")

    return 1 if issues else 0


if __name__ == "__main__":
    raise SystemExit(validate())
