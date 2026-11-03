"""Demo programmes for a MicroGEM60 (12 inputs, 8 relay outputs).

Each is the sort of small job a MicroGEM did: lighting, a crossing, a motor
starter, a pumping station and a packing conveyor. They use only GEM 80
elements (contacts, coils, seal-ins, DELAY, COUNT, SEQR, word logic and OBEY
BLOCK), no extensions, and the first comment lines say how to wire them.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Example:
    key: str
    title: str
    description: str
    source: str


BEDROOM = """\
; Bedroom lighting, MicroGEM style.
; Inputs  A0.0 push-button by the door, A0.1 bedside switch, A0.2 "all off"
; Outputs B0.0 main light, B0.1 bedside lamp, B0.2 landing light (timed)

; One-scan pulse G0.0 each time the door button is pressed
A0.0 AND NOT G0.1 -> G0.0
A0.0 -> G0.1

; The pulse toggles the main light; all-off turns it off
(G0.0 AND NOT B0.0) OR (NOT G0.0 AND B0.0 AND NOT A0.2) -> B0.0

; Bedside switch drives the lamp directly
A0.1 AND NOT A0.2 -> B0.1

; Landing light: on with the main light, held by its own contact (a seal-in),
; until 10 s after the main light goes off
B0.0 OR (B0.2 AND NOT G0.2) -> B0.2
B0.2 AND NOT B0.0 DELAY G10 VALUE 100 -> G0.2

; Count door presses in G11; all-off resets the count
A0.0 COUNT G11 VALUE 1000 RESET A0.2 -> G0.15
"""

PELICAN = """\
; Pelican crossing.
; Inputs  A0.0 pedestrian push-button (use PUSH mode)
; Outputs B0.0 red, B0.1 amber, B0.2 green (traffic),
;         B0.3 red man, B0.4 green man, B0.5 WAIT lamp
; The sequencer G12 steps once a second: bit 0 traffic green, bits 1-3 amber,
; bits 4-10 red with the green man, bits 11-14 flashing amber and green man.

; Half-second flasher: G0.2 on 0.5 s, off 0.5 s
NOT G0.3 DELAY G20 VALUE 5 -> G0.2
G0.2 DELAY G21 VALUE 5 -> G0.3

; WAIT lights at a press and goes out when the green man shows
(A0.0 OR B0.5) AND NOT B0.4 -> B0.5

; Traffic keeps green for at least 5 s
G12.0 DELAY G22 VALUE 50 -> G0.9

; A cycle starts when someone is waiting and runs until bit 15
(B0.5 AND G0.9) OR (G0.1 AND NOT G12.15) -> G0.1
G0.1 AND E0.1 -> SEQR G12 RESET NOT G0.1

; Decode the steps with word masks
AND G12 AND @000E -> G0.6
AND G12 AND @7800 -> G0.7
G12.0 -> B0.2
G0.6 OR (G0.7 AND G0.2) -> B0.1
AND G12 AND @07F0 -> B0.0
B0.0 OR (G0.7 AND G0.2) -> B0.4
NOT B0.4 AND NOT G0.7 -> B0.3
"""

STAR_DELTA = """\
; Star-delta motor starter.
; Inputs  A0.0 START, A0.1 STOP, A0.2 overload trip, A0.3 fault reset
; Outputs B0.0 main contactor, B0.1 star, B0.2 delta, B0.3 running lamp,
;         B0.4 fault lamp
; The motor starts in star, changes to delta after 5 s with a 0.3 s gap
; so the two contactors are never in together.

; Overload latches the fault lamp until reset
(A0.2 OR B0.4) AND NOT A0.3 -> B0.4

; Run latch: START, held by a seal-in, until STOP or a fault
(A0.0 OR G0.0) AND NOT A0.1 AND NOT B0.4 -> G0.0
G0.0 -> B0.0

; Star for 5 s
G0.0 DELAY G10 VALUE 50 -> G0.1
G0.0 AND NOT G0.1 AND NOT B0.2 -> B0.1

; Then a 0.3 s changeover gap, then delta
G0.1 AND NOT B0.1 DELAY G11 VALUE 3 -> B0.2
B0.2 -> B0.3

; Number of starts in G12
G0.0 COUNT G12 VALUE 32767 -> G1.0
"""

PUMPS = """\
; Duty / standby pumping station.
; Inputs  A0.0 low level float, A0.1 high level float, A0.2 high-high float,
;         A0.3 pump 1 fault, A0.4 pump 2 fault, A0.5 alarm accept
; Outputs B0.0 pump 1, B0.1 pump 2, B0.2 alarm beacon, B0.3 pump 2 is duty
; Pump down from high level to low level. The duty pump swaps after each
; run; the standby pump takes over if the duty one faults, and both run on
; high-high. The beacon flashes until accepted, then stays on.

; Half-second flasher G1.0
NOT G1.1 DELAY G20 VALUE 5 -> G1.0
G1.0 DELAY G21 VALUE 5 -> G1.1

; Demand: start at high level, run until the low float drops
(A0.1 OR G0.0) AND A0.0 -> G0.0

; One-scan pulse G0.2 when a run ends; it swaps the duty pump (G0.1)
NOT G0.0 AND G0.3 -> G0.2
G0.0 -> G0.3
(G0.2 AND NOT G0.1) OR (NOT G0.2 AND G0.1) -> G0.1
G0.1 -> B0.3

; Pumps
(G0.0 AND NOT G0.1 AND NOT A0.3) OR (G0.0 AND G0.1 AND A0.4 AND NOT A0.3) OR (A0.2 AND NOT A0.3) -> B0.0
(G0.0 AND G0.1 AND NOT A0.4) OR (G0.0 AND NOT G0.1 AND A0.3 AND NOT A0.4) OR (A0.2 AND NOT A0.4) -> B0.1

; Alarm: high-high or a pump fault; accept stops the flashing
A0.2 OR A0.3 OR A0.4 -> G0.6
(A0.5 OR G0.7) AND G0.6 -> G0.7
(G0.6 AND G0.7) OR (G0.6 AND G1.0) -> B0.2
"""

PACKING = """\
; Bottle packing conveyor.
; Inputs  A0.0 START, A0.1 STOP, A0.2 bottle photo-eye (use PUSH mode),
;         A0.3 empty case in place
; Outputs B0.0 conveyor, B0.1 case full lamp, B0.2 case pusher
; Six bottles fill a case. The conveyor stops, the pusher runs for 2 s to
; push the full case away, and the count starts again. G13 counts cases.

; Run latch
(A0.0 OR G0.0) AND NOT A0.1 -> G0.0

; Conveyor runs while a case is waiting and it is not full
G0.0 AND A0.3 AND NOT G0.1 AND NOT B0.2 -> B0.0

; Count bottles; the pusher resets the count
A0.2 COUNT G10 VALUE 6 RESET B0.2 -> G0.1
G0.1 -> B0.1

; Pusher: starts when full, held for 2 s
(G0.1 OR B0.2) AND NOT G0.2 -> B0.2
B0.2 DELAY G12 VALUE 20 -> G0.2

; Cases packed
B0.2 COUNT G13 VALUE 32767 -> G1.0
"""

EXAMPLES = [
    Example("bedroom", "Bedroom lighting", "Toggle, direct and timed lights (the default).", BEDROOM),
    Example("pelican", "Pelican crossing", "Traffic lights and a crossing, stepped by SEQR.", PELICAN),
    Example("star-delta", "Star-delta starter", "Motor starter with overload and changeover gap.", STAR_DELTA),
    Example("pumps", "Pumping station", "Duty/standby pumps on level floats, with an alarm.", PUMPS),
    Example("packing", "Packing conveyor", "Counts six bottles into each case and pushes it out.", PACKING),
]
