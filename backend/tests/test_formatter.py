"""Formatter unit tests (Phase 7 / Phase 14)."""

from __future__ import annotations

import pytest

from app.core.errors import ValidationAppError
from app.services.formatter import (
    AttributeSpec,
    build_additional_information,
    normalize_values,
)

BALL_VALVE = [
    AttributeSpec("BODY", 1, True),
    AttributeSpec("SEAT", 2, True),
    AttributeSpec("STEM", 3, True),
    AttributeSpec("BALL", 4, True),
    AttributeSpec("OPERATING PRESSURE", 5, True),
    AttributeSpec("OPERATING TEMPERATURE", 6, True),
    AttributeSpec("STANDARD", 7, True),
    AttributeSpec("FLANGE STANDARD", 8, True),
]


def test_full_ball_valve_output_matches_expected():
    values = {
        "BODY": "A105N",
        "SEAT": "F316L+PEEK",
        "STEM": "F316L",
        "BALL": "F316L+ENP",
        "OPERATING PRESSURE": "143.19 TO 153.2 BAR",
        "OPERATING TEMPERATURE": "84 TO -29.38 DEG C",
        "STANDARD": "API 6D 607",
        "FLANGE STANDARD": "B 16.10",
    }
    expected = (
        "BODY:A105N,SEAT:F316L+PEEK,STEM:F316L,BALL:F316L+ENP,"
        "OPERATING PRESSURE:143.19 TO 153.2 BAR,"
        "OPERATING TEMPERATURE:84 TO -29.38 DEG C,"
        "STANDARD:API 6D 607,FLANGE STANDARD:B 16.10"
    )
    assert build_additional_information(BALL_VALVE, values) == expected


def test_order_follows_display_order_not_input_order():
    attrs = [AttributeSpec("B", 2, True), AttributeSpec("A", 1, True)]
    out = build_additional_information(attrs, {"A": "1", "B": "2"})
    assert out == "A:1,B:2"


def test_optional_blank_attributes_skipped():
    attrs = [AttributeSpec("A", 1, True), AttributeSpec("OPT", 2, False)]
    out = build_additional_information(attrs, {"A": "1", "OPT": ""})
    assert out == "A:1"


def test_required_missing_raises():
    attrs = [AttributeSpec("A", 1, True)]
    with pytest.raises(ValidationAppError) as exc:
        build_additional_information(attrs, {"A": ""})
    assert exc.value.code == "REQUIRED_ATTRIBUTE_MISSING"


def test_required_missing_allowed_when_not_require_all():
    attrs = [AttributeSpec("A", 1, True), AttributeSpec("B", 2, False)]
    out = build_additional_information(attrs, {"B": "x"}, require_all=False)
    assert out == "B:x"


def test_whitespace_normalized():
    attrs = [AttributeSpec("A", 1, True)]
    out = build_additional_information(attrs, {"A": "  foo   bar \n baz "})
    assert out == "A:foo bar baz"


def test_comma_in_value_rejected():
    attrs = [AttributeSpec("A", 1, True)]
    with pytest.raises(ValidationAppError) as exc:
        build_additional_information(attrs, {"A": "x,y"})
    assert exc.value.code == "COMMA_IN_VALUE"


def test_no_values_raises():
    attrs = [AttributeSpec("OPT", 1, False)]
    with pytest.raises(ValidationAppError) as exc:
        build_additional_information(attrs, {})
    assert exc.value.code == "NO_ATTRIBUTE_VALUES"


def test_normalize_values_uppercases_keys():
    assert normalize_values({"body": "  a  b "}) == {"BODY": "a b"}
