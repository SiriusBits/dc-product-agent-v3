from dc_extractor.metadata import _split_metadata_list


def test_split_list_handles_quoted_comma_names():
    assert _split_metadata_list('"Negandhi, Nishant"') == ["Negandhi, Nishant"]


def test_split_list_pairs_simple_comma_sequences():
    assert _split_metadata_list("Doe, John, Smith, Jane") == ["Doe, John", "Smith, Jane"]


def test_split_list_returns_none_for_empty():
    assert _split_metadata_list(None) is None
    assert _split_metadata_list(" ") is None
