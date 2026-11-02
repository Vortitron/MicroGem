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
