from dataclasses import dataclass

import tldextract

SIMILAR = {"a": "4", "e": "3", "i": "1l", "l": "1i", "o": "0", "s": "5", "g": "q"}
HOMOGLYPHS = {"a": "а", "c": "с", "e": "е", "o": "о", "p": "р", "x": "х", "i": "і"}
ALT_TLDS = ("com", "net", "org", "co", "io", "app", "info", "biz", "site", "online")
AFFIXES = ("login", "secure", "account", "support", "verify")


@dataclass(frozen=True)
class Variant:
    hostname: str
    technique: str


def generate_variants(domain: str, limit: int = 120) -> list[Variant]:
    ext = tldextract.extract(domain)
    label, suffix = ext.domain, ext.suffix
    found: dict[str, str] = {}

    def add(name: str, technique: str, tld: str = suffix):
        try:
            host = f"{name}.{tld}".lower().encode("idna").decode("ascii")
        except UnicodeError:
            return
        if host != domain and len(host) <= 253:
            found.setdefault(host, technique)

    for i in range(len(label)):
        add(label[:i] + label[i + 1 :], "omission")
        add(label[:i] + label[i] + label[i:], "duplication")
        if i + 1 < len(label):
            add(label[:i] + label[i + 1] + label[i] + label[i + 2 :], "transposition")
        for replacement in SIMILAR.get(label[i], ""):
            add(label[:i] + replacement + label[i + 1 :], "visual-substitution")
        if replacement := HOMOGLYPHS.get(label[i]):
            add(label[:i] + replacement + label[i + 1 :], "homoglyph-idn")
    for i in range(1, len(label)):
        add(label[:i] + "-" + label[i:], "hyphenation")
    for tld in ALT_TLDS:
        if tld != suffix:
            add(label, "tld-swap", tld)
    for affix in AFFIXES:
        add(f"{affix}-{label}", "keyword-affix")
        add(f"{label}-{affix}", "keyword-affix")
    return [Variant(host, tech) for host, tech in list(found.items())[:limit]]
