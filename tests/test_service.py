from microgem.service import ControllerService


def test_commands_drive_the_controller_and_report_errors():
    service = ControllerService(program="A0.0 -> B0.0")
    seen = []
    service.subscribe(seen.append)

    assert service.command({"type": "input", "index": 0, "value": True}) is None
    service.controller.scan(20)
    assert service.controller.output(0)

    reply = service.command({"type": "load", "source": "A0.0 -> B0"})
    assert reply["type"] == "error" and reply["line"] == 1
    assert service.controller.program.source == "A0.0 -> B0.0"  # old program kept

    assert service.command({"type": "load", "source": "A0.1 -> B0.1"}) == {"type": "loaded"}
    service.command({"type": "halt"})
    assert not service.controller.running
    assert seen and seen[-1]["running"] is False


def test_example_program_loads():
    ControllerService()


def test_write_command():
    service = ControllerService(program="A0.0 -> B0.0")
    assert service.command({"type": "write", "address": "G3", "value": 12}) is None
    assert service.state()["tables"]["G"][3] == 12
    assert service.command({"type": "write", "address": "Z1", "value": 1})["type"] == "error"
    assert service.state()["ladder"][0]["actions"] == [{"t": "coil", "addr": "B0.0"}]


def test_read_and_preview_commands():
    service = ControllerService(program="A0.0 -> B0.0")
    service.command({"type": "write", "address": "G2", "value": -5})
    assert service.command({"type": "read", "address": "G2"}) == {"type": "value", "address": "G2", "value": -5}
    assert service.command({"type": "read", "address": "A0.0"})["value"] is False
    reply = service.command({"type": "preview", "source": "A0.1 AND A0.2 -> SET B0.4"})
    assert reply["type"] == "preview" and reply["rungs"][0]["actions"] == [{"t": "set", "addr": "B0.4"}]
    assert service.command({"type": "preview", "source": "A0.1 ->"})["type"] == "error"
    assert service.controller.program.source == "A0.0 -> B0.0"  # preview never loads
