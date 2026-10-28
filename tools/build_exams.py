from __future__ import annotations

import json
import re
from pathlib import Path

from pypdf import PdfReader


ROOT = Path(__file__).resolve().parents[2]
SITE = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "2000-2017西南政法大学考博英语试题及解析.pdf"


def compact_page(text: str, page_number: int) -> str:
    kept: list[str] = []
    for raw in text.replace("\r", "\n").splitlines():
        line = re.sub(r"[ \t]+", " ", raw).strip()
        if not line:
            if kept and kept[-1] != "":
                kept.append("")
            continue
        if "www.boshitest.com" in line:
            continue
        if line.startswith("咨询 QQ：") or line.startswith("咨询QQ："):
            continue
        if re.fullmatch(rf"{page_number}", line):
            continue
        kept.append(line)
    while kept and kept[-1] == "":
        kept.pop()
    return "\n".join(kept)


def extract_pages(reader: PdfReader, start: int, end: int) -> str:
    pages: list[str] = []
    for page_number in range(start, end + 1):
        text = compact_page(reader.pages[page_number - 1].extract_text() or "", page_number)
        pages.append(f"第 {page_number - start + 1} 页\n\n{text}")
    return "\n\n────────────────────────\n\n".join(pages)


def extract_single(path: Path) -> str:
    reader = PdfReader(path)
    return extract_pages(reader, 1, len(reader.pages))


def letters(spec: str) -> str:
    return "".join(re.findall(r"[A-D?]", spec.upper()))


def choice(
    ident: str,
    title: str,
    start: int,
    count: int,
    score: int,
    key: str | None,
) -> dict:
    parsed = letters(key) if key else None
    if parsed and len(parsed) != count:
        raise ValueError(f"{ident}: expected {count} answers, got {len(parsed)}")
    return {
        "id": ident,
        "title": title,
        "kind": "choice",
        "start": start,
        "count": count,
        "score": score,
        "key": parsed,
    }


def written(ident: str, title: str, score: int, hint: str) -> dict:
    return {
        "id": ident,
        "title": title,
        "kind": "written",
        "score": score,
        "hint": hint,
    }


RANGES = {
    2017: (2, 11),
    2015: (20, 29),
    2014: (40, 49),
    2013: (59, 69),
    2012: (77, 85),
    2011: (93, 102),
    2010: (109, 119),
    2009: (129, 141),
    2008: (150, 161),
    2007: (167, 176),
    2006: (182, 191),
    2005: (195, 206),
    2003: (213, 224),
    2000: (225, 231),
}


SECTIONS = {
    2017: [
        choice("vocab", "Part I · Vocabulary", 1, 20, 10, "CACBADADBBCBBABDADDA"),
        choice("reading", "Part II · Reading Comprehension", 1, 20, 20, "BBCABDABACDABCBCABDB"),
        written("translation", "Part III · 汉译英", 10, "在此完成整段汉译英。建议先列关键词，再组织句子。"),
        written("writing", "Part IV · Writing", 30, "按原题要求完成作文。"),
        written("legal-cn-en", "法律英语 · 中译英", 15, "逐题作答，注意法律术语的一致性。"),
        written("legal-en-cn", "法律英语 · 英译中", 15, "逐题作答，注意规范中文法律表达。"),
    ],
    2015: [
        choice("vocab", "Part I · Vocabulary", 1, 20, 10, "CBCDBDDDCDDBDDBDDBCA"),
        choice("reading", "Part II · Reading Comprehension", 21, 20, 20, "BCCDCCCCACBDACABBACC"),
        written("translation", "Part III · Translation", 15, "完成中译英与英译中。"),
        written("writing", "Part IV · Writing", 25, "按原题要求完成作文。"),
        written("legal", "Legal English", 30, "完成法律英语翻译题。"),
    ],
    2014: [
        choice("vocab", "Part I · Vocabulary", 1, 20, 10, "DACAAAAADAABDABABCDA"),
        choice("reading", "Part II · Reading Comprehension", 21, 15, 15, "CBACAACCBABDACA"),
        written("translation", "Part III · Translation", 20, "完成中译英与英译中。"),
        written("writing", "Part IV · Writing", 25, "按原题要求完成作文。"),
        written("legal", "Part V · Legal English", 30, "完成法律英语部分。"),
    ],
    2013: [
        choice("vocab", "Part I · Vocabulary", 1, 20, 10, "CBBCDDCAABDBBBDBACAA"),
        choice("reading", "Part II · Reading Comprehension", 21, 20, 20, "BAACDCDBACBABDBDCBAB"),
        written("translation", "Part III · Translation", 10, "完成翻译题。"),
        written("writing", "Part IV · Writing", 30, "按原题要求完成作文。"),
        written("legal-en-cn", "Part V · 法律英译中", 20, "完成法律英语段落翻译。"),
        written("legal-cn-en", "Part VI · 法律中译英", 10, "完成法律汉语段落翻译。"),
    ],
    2012: [
        choice("vocab", "Part I · Vocabulary", 1, 20, 10, "DBADDCBAABDBDACCBBCB"),
        choice("reading", "Part II · Reading Comprehension", 21, 20, 20, "CDDBABBDBCDBB?BACBDB"),
        written("translation", "Part III · Translation", 10, "完成句子汉译英。"),
        written("writing", "Part IV · Writing", 30, "按原题要求完成作文。"),
        written("legal", "法律英语（B卷）", 30, "完成法律英语翻译题。"),
    ],
    2011: [
        choice("vocab", "Part I · Vocabulary", 1, 20, 10, "CDDBBCBBABDCDCDADBCD"),
        choice("reading", "Part II · Reading Comprehension", 21, 20, 20, "DCBDDCDCBDCADACCBBDC"),
        written("translation", "Part III · Translation", 10, "完成句子汉译英。"),
        written("writing", "Part IV · Writing", 30, "按原题要求完成作文。"),
        written("legal", "法律英语", 30, "完成法律英语翻译题。"),
    ],
    2010: [
        choice("vocab", "Part I · Vocabulary", 1, 20, 10, "DDCBAABBDACCBCBBBCDD"),
        choice("cloze", "Part II · Cloze", 21, 10, 10, "ADACAABCDB"),
        choice("reading", "Part III · Reading Comprehension", 31, 30, 20, "BCCBABDBDBDABBDCCDDAADDCBDDBAD"),
        written("writing", "Part IV · Writing", 30, "按原题要求完成作文。"),
        written("legal-en-cn", "Part V · 法律英译中", 20, "完成法律英语段落翻译。"),
        written("legal-cn-en", "Part VI · 法律中译英", 10, "完成法律汉语句子翻译。"),
    ],
    2009: [
        choice("vocab", "Part I · Vocabulary", 1, 20, 10, "CBBADDACCCBCACADDCDA"),
        choice("cloze", "Part II · Cloze", 21, 20, 10, "BAAAABACDDABCBABCADA"),
        choice("reading", "Part III · Reading Comprehension", 41, 25, 25, "ABBADBCABADACDBBDCBBBBCBA"),
        written("writing", "Part IV · Composition", 25, "按原题要求完成作文。"),
        written("legal-en-cn", "Part V · 法律英译中", 20, "完成法律英语段落翻译。"),
        written("legal-cn-en", "Part VI · 法律中译英", 10, "完成法律汉语句子翻译。"),
    ],
    2008: [
        choice("vocab", "Part I · Vocabulary", 1, 20, 10, "CABDDABBBADADABAAACD"),
        choice("reading", "Part II · Reading Comprehension", 21, 25, 25, "CABDCCBACBBDCAADBCACDCBDA"),
        written("writing", "Part III · Composition", 25, "按原题要求完成作文。"),
        written("legal", "法律英语翻译", 40, "完成英译中与中译英。"),
    ],
    2007: [
        choice("vocab", "Part I · Vocabulary", 1, 20, 10, "ADDAADAABDDBBACCDDCB"),
        choice("reading", "Part II · Reading Comprehension", 21, 24, 24, "CCBBDAACBDBBACCBADCCCADB"),
        written("writing", "Part III · Writing", 26, "按原题要求完成作文。"),
        written("legal-en-cn", "Part V · 法律英译中", 30, "完成法律英语段落翻译。"),
        written("legal-cn-en", "Part VI · 法律中译英", 10, "完成法律汉语段落翻译。"),
    ],
    2006: [
        choice("listening", "Part I · Listening Comprehension", 1, 20, 20, None),
        choice("reading", "Part II · Reading Comprehension", 1, 20, 20, "BAABBBCDADDBCCDADBCA"),
        written("writing", "Part III · Writing", 20, "按原题要求完成作文。"),
        written("legal", "法律英语翻译", 40, "完成法律英语翻译题。"),
    ],
    2005: [
        choice("listening", "Part I · Listening Comprehension", 1, 20, 20, None),
        choice("vocab", "Part II · Vocabulary", 21, 20, 20, "ABCCBADAACBAADBCABDC"),
        choice("reading", "Part III · Reading Comprehension", 41, 20, 20, "BDCDADBADCBBDACCBABA"),
        written("legal-en-cn", "Part IV · 英译中", 20, "完成段落英译中。"),
        written("legal-cn-en", "Part V · 中译英", 20, "完成句子中译英。"),
    ],
    2003: [
        choice("reading", "Part I · Reading Comprehension", 1, 30, 30, None),
        choice("vocab", "Part III · Vocabulary & Structure", 31, 20, 10, None),
        written("translation", "Translation", 60, "按原题完成翻译题；本资料未附标准答案。"),
    ],
    2000: [
        choice("vocab", "Part I · Vocabulary & Structure", 1, 20, 10, None),
        choice("cloze", "Part II · Cloze", 21, 12, 10, None),
        choice("reading", "Part III · Reading Comprehension", 33, 13, 40, None),
        written("legal-en-cn", "Part IV · 英译中", 20, "完成段落英译中。"),
        written("legal-cn-en", "Part V · 中译英", 20, "完成段落中译英。"),
    ],
}


def total_score(sections: list[dict]) -> int:
    return sum(section["score"] for section in sections)


def main() -> None:
    reader = PdfReader(SOURCE)
    exams: list[dict] = []
    for year, (start, end) in RANGES.items():
        sections = SECTIONS[year]
        exams.append(
            {
                "id": str(year),
                "year": year,
                "title": f"{year} 年博士研究生入学考试英语试题",
                "kind": "full",
                "source": "2000–2017 历年试题及解析汇编",
                "sourcePages": f"{start}–{end}",
                "score": total_score(sections),
                "sections": sections,
                "paper": extract_pages(reader, start, end),
            }
        )

    memories = [
        (
            2024,
            ROOT / "西南政法大学考博英语2024年.pdf",
            [
                choice("cloze", "一、完形填空", 1, 20, 20, None),
                written("translation-general", "二、通用翻译", 30, "完成汉译英与英译中。"),
                written("translation-legal", "三、法律翻译", 30, "完成法律英语双向翻译。"),
                written("writing", "四、作文", 20, "以“法治国家建设”为题，写一篇约 200 词作文。"),
            ],
        ),
        (
            2022,
            ROOT / "版本二" / "西南政法大学考博英语2022.pdf",
            [
                written("translation", "一、翻译", 60, "按回忆版题面完成句子和段落双向翻译。"),
                written("writing-long", "二、写作 · 大作文", 25, "陈述创新的重要性。"),
                written("writing-short", "二、写作 · 小作文", 15, "拟写组织参加法律文书活动的通知或邀请。"),
            ],
        ),
        (
            2019,
            ROOT / "西南政法大学大学19年题型及写作题目（题型有变化）.pdf",
            [
                choice("reading", "一、阅读", 1, 25, 25, None),
                choice("cloze", "二、完形", 1, 20, 20, None),
                written("writing", "三、写作", 25, "围绕“学术不端”写一篇不少于 150 词的议论文。"),
                written("translation", "四、专业英语翻译", 30, "完成英译中与汉译英。"),
            ],
        ),
    ]
    for year, path, sections in memories:
        exams.append(
            {
                "id": str(year),
                "year": year,
                "title": f"{year} 年题型回忆版",
                "kind": "memory",
                "source": path.name,
                "sourcePages": "1",
                "score": total_score(sections),
                "sections": sections,
                "paper": extract_single(path),
            }
        )

    exams.sort(key=lambda exam: exam["year"], reverse=True)
    payload = {
        "generatedAt": "2026-10-28",
        "sourceNotice": "完整套卷来自 2000–2017 汇编；2019、2022、2024 为题型回忆版，缺失题干不作补写。",
        "exams": exams,
    }
    target = SITE / "data" / "exams.js"
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(
        "window.SWUPL_EXAMS = " + json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + ";\n",
        encoding="utf-8",
    )
    print(f"wrote {target} ({target.stat().st_size:,} bytes, {len(exams)} exams)")


if __name__ == "__main__":
    main()
