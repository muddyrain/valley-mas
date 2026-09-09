import re


def require_asset_id(value):
    if not re.fullmatch(r"BH_[A-Za-z0-9_]+", value):
        raise ValueError(f"Invalid BLUE HOUR asset ID: {value}")
    return value
