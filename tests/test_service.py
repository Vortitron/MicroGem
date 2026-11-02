from microgem.server import handle_command
from microgem.service import ControllerService


def test_commands_drive_the_controller_and_report_errors():
    service = ControllerService(program="A0.0 -> B0.0")
    seen = []
    service.subscribe(seen.append)

    assert handle_command(service, {"type": "input", "index": 0, "value": True}) is None
    service.controller.scan(20)
    assert service.controller.output(0)

    reply = handle_command(service, {"type": "load", "source": "A0.0 -> B0"})
    assert reply["type"] == "error" and reply["line"] == 1
    assert service.controller.program.source == "A0.0 -> B0.0"  # old program kept

    assert handle_command(service, {"type": "load", "source": "A0.1 -> B0.1"}) == {"type": "loaded"}
    handle_command(service, {"type": "halt"})
    assert not service.controller.running
    assert seen and seen[-1]["running"] is False


def test_example_program_loads():
    ControllerService()
