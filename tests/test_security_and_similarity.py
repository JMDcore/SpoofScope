from bs4 import BeautifulSoup

from spoofscope.scanner import dns_is_public, structural_features, structural_similarity


def test_private_addresses_are_rejected():
    assert not dns_is_public({"A": ["127.0.0.1"]})
    assert not dns_is_public({"A": ["10.20.30.40"]})
    assert dns_is_public({"A": ["8.8.8.8"]})


def test_structural_features_are_stable_and_comparable():
    first, first_hash = structural_features(
        BeautifulSoup(
            "<html><body><main><form><input type='email'><input type='password'></form></main></body></html>",
            "html.parser",
        )
    )
    second, second_hash = structural_features(
        BeautifulSoup(
            "<html><body><main><form><input type='email'><input type='password'></form></main></body></html>",
            "html.parser",
        )
    )
    unrelated, _ = structural_features(
        BeautifulSoup("<html><body><article><p>News</p></article></body></html>", "html.parser")
    )
    assert first_hash == second_hash
    assert structural_similarity(first, second) == 1
    assert structural_similarity(first, unrelated) < 0.5
