"""The demo programmes load and do what their comments say."""

import re

from microgem import Controller, parse_address
from microgem.examples import EXAMPLES
from microgem.service import ControllerService


def make(key: str) -> Controller:
    plc = Controller()
    plc.load(next(e for e in EXAMPLES if e.key == key).source)
    plc.run()
    return plc


def run_for(plc: Controller, ms: int, step: int = 20) -> None:
    for _ in range(ms // step):
        plc.scan(step)


def test_every_example_loads_without_extensions():
    for example in EXAMPLES:
        Controller().load(example.source)
        code = "\n".join(line for line in example.source.splitlines() if not line.startswith(";"))
        assert not re.search(r"\b(RISE|FALL|SET|EQ|NE|GT|LT|GE|LE)\b|->\s*RESET\b", code), example.key


def test_examples_command():
    reply = ControllerService().command({"type": "examples"})
    assert [e["key"] for e in reply["examples"]][0] == "bedroom"
    assert all(e["source"] and e["title"] for e in reply["examples"])


def test_pelican_crossing_cycle():
    plc = make("pelican")
    run_for(plc, 6000)
    assert plc.outputs()[:6] == [False, False, True, True, False, False]  # green, red man
    plc.set_input(0, True)
    plc.scan(20)
    plc.set_input(0, False)
    plc.scan(20)
    assert plc.output(5)  # WAIT
    run_for(plc, 2000)
    assert plc.output(1) and not plc.output(2)  # amber
    run_for(plc, 3000)
    assert plc.output(0) and plc.output(4) and not plc.output(3) and not plc.output(5)  # red, green man
    run_for(plc, 7000)
    assert not plc.output(0) and not plc.output(3)  # flashing phase
    run_for(plc, 5000)
    assert plc.output(2) and plc.output(3)  # back to green, red man


def test_star_delta_starter():
    plc = make("star-delta")
    plc.set_input(0, True)
    plc.scan(20)
    plc.set_input(0, False)
    run_for(plc, 1000)
    assert plc.output(0) and plc.output(1) and not plc.output(2)  # main + star
    run_for(plc, 4100)
    assert plc.output(0) and not plc.output(1) and not plc.output(2)  # changeover gap
    run_for(plc, 400)
    assert plc.output(2) and plc.output(3) and not plc.output(1)  # delta, running
    plc.set_input(2, True)  # overload
    plc.scan(20)
    plc.scan(20)
    assert plc.output(4) and not any(plc.outputs()[:4])
    plc.set_input(2, False)
    plc.set_input(3, True)
    plc.scan(20)
    assert not plc.output(4)


def test_pumps_alternate_and_alarm():
    plc = make("pumps")
    def cycle():
        plc.set_input(0, True)
        plc.set_input(1, True)
        plc.scan(20)
        running = (plc.output(0), plc.output(1))
        plc.set_input(1, False)
        plc.scan(20)
        plc.set_input(0, False)
        plc.scan(20)
        plc.scan(20)
        return running
    assert cycle() == (True, False)
    assert cycle() == (False, True)
    assert cycle() == (True, False)
    plc.set_input(3, True)  # pump 1 faults: pump 2 stands in
    assert cycle() == (False, True)
    assert cycle() == (False, True)
    run_for(plc, 1000)
    flashes = set()
    for _ in range(60):
        plc.scan(20)
        flashes.add(plc.output(2))
    assert flashes == {True, False}
    plc.set_input(5, True)
    run_for(plc, 1000)
    assert plc.output(2)


def test_packing_conveyor():
    plc = make("packing")
    plc.set_input(3, True)
    plc.set_input(0, True)
    plc.scan(20)
    plc.set_input(0, False)
    plc.scan(20)
    assert plc.output(0)
    for _ in range(6):
        plc.set_input(2, True)
        plc.scan(20)
        plc.set_input(2, False)
        plc.scan(20)
    assert not plc.output(0) and plc.output(2)  # stopped, pushing
    run_for(plc, 2100)
    assert not plc.output(2) and plc.output(0)  # pushed, running again
    assert plc.tables.get_word(parse_address("G13")) & 0x7FFF == 1  # one case packed
