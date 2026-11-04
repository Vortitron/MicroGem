"""Print-outs, and bringing old programmes in from print-outs and CSV files."""

import pytest

from microgem.examples import EXAMPLES, GEM80_EXAMPLES
from microgem.importer import import_text
from microgem.printout import PrintoutError, print_program, read_printout
from microgem.program import ProgramError, parse_program, rung_to_json
from microgem.service import ControllerService
from microgem.engine import ControllerConfig
from microgem.tables import parse_address


def shape(source: str):
    def strip(o):
        if isinstance(o, dict):
            return {k: strip(v) for k, v in o.items() if k not in ("id", "line", "source", "comment")}
        if isinstance(o, list):
            return [strip(x) for x in o]
        return o
    return [strip(rung_to_json(r)) for r in parse_program(source).rungs]


@pytest.mark.parametrize("example", EXAMPLES + GEM80_EXAMPLES, ids=lambda e: e.key)
def test_every_example_survives_a_printout(example):
    printed = print_program(parse_program(example.source), example.title, "GEM 80/130C 12K")
    assert shape(read_printout(printed)) == shape(example.source)


def test_nested_branches_names_and_presets_round_trip():
    source = """\
NAME A0.0 START Start push button
NAME B0.0 RUN
PRESET G100 = 0 1067 3200

; Nested branches
((START AND (A0.1 OR A0.2)) OR (G0.0 AND NOT G0.1)) AND A0.3 -> RUN
A0.4 AND 0 SPEC RAMP VALUE G100 -> OUT G90
A0.5 COUNT G11 VALUE 10 RESET A0.6 -> B0.3
"""
    printed = print_program(parse_program(source))
    assert "RUNG 1   INSTRUCTIONS" in printed and "CROSS REFERENCE" in printed
    assert "NAME A0.0 START Start push button" in printed and "PRESET G100 = 1067" not in printed
    back = read_printout(printed)
    assert shape(back) == shape(source)
    program = parse_program(back)
    assert program.notes == parse_program(source).notes
    assert program.presets == parse_program(source).presets
    assert program.rungs[0].comment == "Nested branches"


def test_a_programmer_screen_layout_reads_too():
    # The 8920 draws without angle brackets, with | for verticals and slashed zeros.
    screen = """\
+--] [-----DELAY----VALUE----( )--+
|  AØ.Ø    G1Ø      25       BØ.Ø |
"""
    assert read_printout(screen).strip() == "A0.0 DELAY G10 VALUE 25 -> B0.0"


def test_a_broken_drawing_names_its_line():
    with pytest.raises(PrintoutError, match="line 3"):
        read_printout("heading\n\n+--] [--?? \n!  A0.0\n")


def test_import_csv_names_and_data_into_the_current_programme():
    current = "NAME A0.0 OLD Old name\nA0.0 -> B0.0\n"
    csv = "Address,Mnemonic,Description\nA000.00,start,Start push button\nA0/1,Stop PB,Stop; NC\nG10,250\nB0.0,AND,clash\n"
    result = import_text(csv, current)
    assert result["kind"] == "table" and result["summary"] == "3 names and 1 preset added"
    program = parse_program(result["source"])
    assert program.notes[parse_address("A0.0")] == ("START", "Start push button")
    assert program.notes[parse_address("A0.1")] == ("STOP_PB", "Stop, NC")
    assert program.notes[parse_address("B0.0")][0] == "AND_"
    assert program.presets[parse_address("G10")] == 250
    assert len(program.rungs) == 1 and "OLD" not in result["source"]


def test_import_detects_printouts_and_program_text():
    printed = print_program(parse_program(GEM80_EXAMPLES[0].source))
    assert import_text(printed)["kind"] == "printout"
    assert import_text("A0.0 -> B0.0")["kind"] == "program"
    with pytest.raises(ProgramError):
        import_text("A0.0 AND -> B0.0")
    with pytest.raises(ProgramError):
        import_text("   ")


def test_service_prints_and_imports():
    service = ControllerService(ControllerConfig(model="gem80-130c-12k", modules=("8163", "8164")))
    reply = service.command({"type": "printout", "title": "Line 3"})
    assert reply["type"] == "printout" and reply["text"].startswith("Line 3  GEM 80/130C 12K")
    reply = service.command({"type": "import", "text": reply["text"]})
    assert reply["type"] == "imported" and reply["kind"] == "printout"
    assert shape(reply["source"]) == shape(service.controller.program.source)

