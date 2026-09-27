from spoofscope.scanner import candidate_score


def test_explainable_score():
    score, signals = candidate_score(
        {
            "dns": {"A": ["1.2.3.4"]},
            "http": {"reachable": True, "brand_mentions": 2, "password_forms": 1, "forms": 1},
        },
        "acme",
    )
    assert score == 78
    assert "Contains a password input" in signals
