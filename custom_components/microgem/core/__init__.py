"""A virtual GEC MicroGEM / GEM 80 programmable controller."""

from .engine import MAX_EXPANSIONS, Controller, ControllerConfig
from .program import ProgramError, parse_program
from .tables import Address, AddressError, DataTables, parse_address

__all__ = [
    "Address",
    "AddressError",
    "Controller",
    "ControllerConfig",
    "MAX_EXPANSIONS",
    "DataTables",
    "ProgramError",
    "parse_address",
    "parse_program",
]

__version__ = "0.3.4"
