from spoofscope.schemas import DomainCreate
from spoofscope.typos import generate_variants


def test_variants_are_unique_and_exclude_source():
    variants = generate_variants("example.com", 500)
    names = [x.hostname for x in variants]
    assert "example.com" not in names
    assert len(names) == len(set(names))
    assert "exmaple.com" in names
    assert "example.net" in names


def test_domain_validation():
    assert DomainCreate(name="EXAMPLE.COM.", authorized=True).name == "example.com"


def test_domain_validation_rejects_ip_and_invalid_labels():
    import pytest

    with pytest.raises(ValueError):
        DomainCreate(name="127.0.0.1", authorized=True)
    with pytest.raises(ValueError):
        DomainCreate(name="bad_label.example", authorized=True)
