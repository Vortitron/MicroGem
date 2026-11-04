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

BOTTLING = """\
; Bottle filling line, for a GEM 80/100C 12K, 100CE or 130C, with the default modules.
; Inputs  A0.0 start, A0.1 stop (normally closed), A0.2 bottle at the filler,
;         A0.3 level probe (bottle full), A0.4 reset the count,
;         A4.0 emergency stop healthy (normally closed)
; Outputs B6.0 conveyor, B6.1 fill valve, B6.2 running lamp, B6.3 slow fill horn,
;         B6.4 crate complete beacon; the 16 lamps on B2 show the crates in BCD
; Special Functions: DBOUNCE on the bottle sensor, DIV into crates of 12 with
; the odd bottles as the remainder, BCDOUT for the display, COMPARE for the beacon.

; DBOUNCE data: the sensor must be steady for 3 scans, mode on
AND 3 -> OUT G21
AND -1 -> OUT G24

; Run latch: start, held by its own contact, dropped by stop or the e-stop
(A0.0 OR G0.0) AND A0.1 AND A4.0 -> G0.0
G0.0 -> B6.2

; Bottle sensor, debounced
A0.2 SPEC DBOUNCE VALUE G20 -> G0.1

; Fill while a bottle is in place and not yet full; the conveyor waits
G0.0 AND G0.1 AND NOT A0.3 -> B6.1
G0.0 AND NOT B6.1 -> B6.0

; A fill taking more than 8 s sounds the horn
B6.1 DELAY G10 VALUE 80 -> B6.3

; Count full bottles; A0.4 resets the count
G0.1 AND A0.3 COUNT G11 VALUE 9999 RESET A0.4 -> G0.2

; Crates of 12: the quotient to G12, the bottles left over to G13
AND G11 AND @7FFF SPEC DIV [AND 12] VALUE G13 -> OUT G12

; Crates on the display lamps, in BCD
AND G12 SPEC BCDOUT -> OUT B2

; Beacon while a crate has just been completed: G13 = 0 and G12 > 0
AND G13 SPEC COMPARE [AND 0] VALUE G14 -> OUT G15
AND G12 SPEC COMPARE [AND 0] VALUE G16 -> OUT G17
G14.15 AND G16.13 -> B6.4
"""

CAR_WASH = """\
; Car wash, for any GEM 80 (only the basic Special Functions) with the default modules.
; Inputs  A0.0 start (coin accepted), A0.1 car in position (photocell),
;         A0.2 stop (normally closed), A4.0 emergency stop healthy (normally closed)
; Outputs B6.0 water pump, B6.1 brushes, B6.2 dryer fan, B6.3 drive forward sign,
;         B6.4 wash complete lamp; the 16 lamps on B2 show the washes in BCD
; Special Functions: DBOUNCE on the photocell, BCDOUT for the display.

; DBOUNCE data: the photocell must be steady for 3 scans, mode on
AND 3 -> OUT G21
AND -1 -> OUT G24
A0.1 SPEC DBOUNCE VALUE G20 -> G1.0

; Cycle latch: start with a car in place, held until the end of the cycle,
; dropped by stop or the e-stop
((A0.0 AND G1.0) OR G0.0) AND A0.2 AND A4.0 AND NOT G0.2 -> G0.0

; 20 s of water and brushes, then 10 s of drying
G0.0 DELAY G10 VALUE 200 -> G0.1
G0.0 AND NOT G0.1 -> B6.0
G0.0 AND NOT G0.1 -> B6.1
G0.1 DELAY G11 VALUE 100 -> G0.2
G0.1 AND NOT G0.2 -> B6.2

; Count the washes, and light the wash complete lamp for 5 s
G0.2 COUNT G12 VALUE 9999 -> G0.3
G0.2 OR (B6.4 AND NOT G0.4) -> B6.4
B6.4 DELAY G13 VALUE 50 -> G0.4

; Drive forward until the car is in position
NOT G0.0 AND NOT G1.0 -> B6.3

; Washes on the display lamps, in BCD
AND G12 SPEC BCDOUT -> OUT B2
"""

HEATING = """\
; Room heating with three-term control and a printed log, for a GEM 80/130C
; with the default modules (the 8108 analogue module is in slots 5 and 6).
; Analogue A8 (8108): channel 0 room temperature, 0 to 10 V for 0 to 40 C;
;         channel 1 the set point knob, 0 to 10 V for 5 to 30 C
; Inputs  A0.0 heating on
; Outputs B6.0 heater (time-proportioned over 10 s), B6.1 heating on lamp,
;         B6.2 too hot lamp (2 C over the set point)
; Printer a time-stamped line when the heating goes on or off, or it gets too hot
; Special Functions: LOCATE and MOVE to read the 8108, LINCON to scale,
; PIDABS for the control, DIV and COMPARE for the heater, WRITEXT and WRINUM.
; In Home Assistant, wire channel 0 to a temperature sensor and B6.0 to a heater.

NAME A0.0 HEATING Heating on switch
NAME B6.0 HEATER Heater contactor
NAME B6.1 ONLAMP Heating on lamp
NAME B6.2 TOOHOT Too hot lamp
NAME G120 TEMP Room temperature, 0.1 C
NAME G121 SETPT Set point, 0.1 C
NAME G140 OUTPUT Heater output, 0.1 percent
NAME G150 TICKS Tenths of a second in the heater cycle

; LINCON data (F M D C): the temperature in tenths of a degree, 0 to 400,
; and the set point, 50 to 300
PRESET R100 = 0 400 32000 0
PRESET R104 = 0 250 32000 50
; PIDABS data: F P I D L+ L- L1 L2 S H
PRESET R200 = 0 600 40 0 1000 0 1000 1000 1 0
; The printed text
MESSAGE P100 = ":"
MESSAGE P102 = "0"
MESSAGE P104 = "  HEATING ON, SET POINT "
MESSAGE P120 = "  HEATING OFF, ROOM "
MESSAGE P140 = "  TOO HOT, ROOM "
MESSAGE P160 = "."
MESSAGE P162 = " C\\n"

; Read the 8108 (as in its manual, T443 8.3): the channel to G20, the value
; to G21, then MOVE it to G100 + channel: G100 is channel 0, G101 channel 1
AND A8 AND 15 -> OUT G20
AND A8 AND @FFF0 -> OUT G21
AND 0 SPEC LOCATE VALUE G21 SPEC MOVE [AND G20 SPEC LOCATE VALUE G100] VALUE 1 -> OUT G22

; Scale to tenths of a degree
AND G100 SPEC LINCON VALUE R100 -> OUT TEMP
AND G101 SPEC LINCON VALUE R104 -> OUT SETPT

; PIDABS runs while the heating is on (S = 1); S = 0 runs the output down
AND 0 -> OUT R208
HEATING -> BLOCK
AND 1 -> OUT R208
END BLOCK

; Three-term control once a second, on the error: set point - temperature
E0.1 -> BLOCK
AND SETPT SUB TEMP SPEC PIDABS VALUE R200 -> OUT OUTPUT
END BLOCK

; A 10 s heater cycle: TICKS counts 0 to 99 in tenths of a second
E0.0 -> BLOCK
AND TICKS ADD 1 -> OUT TICKS
END BLOCK
AND TICKS SPEC COMPARE [AND 99] VALUE G151 -> OUT G152
G151.13 -> BLOCK
AND 0 -> OUT TICKS
END BLOCK

; The heater is on while the output in percent is more than the count
AND OUTPUT SPEC DIV [AND 10] VALUE G153 -> OUT G154
AND G154 SPEC COMPARE [AND TICKS] VALUE G155 -> OUT G156
HEATING AND G155.13 -> HEATER
HEATING -> ONLAMP

; Too hot: 2 C (20 tenths) over the set point
AND SETPT ADD 20 SPEC COMPARE [AND TEMP] VALUE G157 -> OUT G158
HEATING AND G157.11 -> TOOHOT

; One-scan pulses: G1.0 heating on, G1.2 heating off, G1.3 too hot
HEATING AND NOT G1.1 -> G1.0
NOT HEATING AND G1.1 -> G1.2
HEATING -> G1.1
TOOHOT AND NOT G1.4 -> G1.3
TOOHOT -> G1.4

; Each log line starts with the time, hh:mm, from the clock in E3 and E2
G1.0 OR G1.2 OR G1.3 -> BLOCK
AND E3 SPEC WRINUM VALUE 2 -> OUT G160
AND 1 SPEC WRITEXT VALUE P100 -> OUT G160
AND E2 SPEC COMPARE [AND 10] VALUE G164 -> OUT G165
G164.11 -> BLOCK
AND 1 SPEC WRITEXT VALUE P102 -> OUT G160
END BLOCK
AND E2 SPEC WRINUM VALUE 0 -> OUT G160
END BLOCK

G1.0 -> BLOCK
AND 1 SPEC WRITEXT VALUE P104 -> OUT G160
AND SETPT -> OUT G170
END BLOCK
G1.2 -> BLOCK
AND 1 SPEC WRITEXT VALUE P120 -> OUT G160
AND TEMP -> OUT G170
END BLOCK
G1.3 -> BLOCK
AND 1 SPEC WRITEXT VALUE P140 -> OUT G160
AND TEMP -> OUT G170
END BLOCK

; Then the degrees in G170, to a tenth, and the end of the line
G1.0 OR G1.2 OR G1.3 -> BLOCK
AND G170 SPEC DIV [AND 10] VALUE G171 -> OUT G172
AND G172 SPEC WRINUM VALUE 0 -> OUT G160
AND 1 SPEC WRITEXT VALUE P160 -> OUT G160
AND G171 SPEC WRINUM VALUE 0 -> OUT G160
AND 1 SPEC WRITEXT VALUE P162 -> OUT G160
END BLOCK
"""

#: Demo programmes for the GEM 80 compact controllers (default modules).
GEM80_EXAMPLES = [
    Example("bottling", "Bottle filling line", "Fills, counts and crates bottles, with Special Functions.", BOTTLING),
    Example("car-wash", "Car wash", "A timed wash and dry cycle that any GEM 80 can run.", CAR_WASH),
    Example("heating", "Room heating", "PID control from an analogue input, with a printed log (130C).", HEATING),
]

EXAMPLES = [
    Example("bedroom", "Bedroom lighting", "Toggle, direct and timed lights (the default).", BEDROOM),
    Example("pelican", "Pelican crossing", "Traffic lights and a crossing, stepped by SEQR.", PELICAN),
    Example("star-delta", "Star-delta starter", "Motor starter with overload and changeover gap.", STAR_DELTA),
    Example("pumps", "Pumping station", "Duty/standby pumps on level floats, with an alarm.", PUMPS),
    Example("packing", "Packing conveyor", "Counts six bottles into each case and pushes it out.", PACKING),
]


def examples_for(family: str) -> list[Example]:
    return GEM80_EXAMPLES if family == "gem80" else EXAMPLES


def default_program(family: str) -> str:
    return examples_for(family)[0].source
