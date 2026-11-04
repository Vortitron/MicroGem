"""The controllers the emulator can be: a MicroGEM60 or a GEM 80 compact controller.

The GEM 80 figures come from the GEM 80/100C/100CE/130C/130CE Compact
Controller Series product data sheet (T278, issue 3, 9.87): Table 2 gives the
size of each data table and the program capacity, Table 4 which Special
Functions each controller has. The P and F tables are listed there in two
parts (configuration and user presets, built-in and user diagnostics); here
each table is one run of words, the first part first.

The MicroGEM figures are the emulator's own (no MicroGEM manual has been
found): every table 64 words, as the emulator has always had.
"""

from __future__ import annotations

from dataclasses import dataclass, field

#: Special Functions by number, with the mnemonic the programmer accepts.
SPECIAL_NAMES = {
    "S0": "DBOUNCE",
    "S1": "BCDIN",
    "S2": "BCDOUT",
    "S3": "HISTATE",
    "S4": "SWAP",
    "S11": "LINCON",
    "S12": "SQRT",
    "S20": "LOCATE",
    "S22": "WRITEXT",
    "S23": "WRINUM",
    "S30": "FGEN",
    "S31": "DEDBAND",
    "S32": "LIMIT",
    "S33": "RAMP",
    "S34": "PIDABS",
    "S35": "PIDINC",
    "S36": "INCOUT",
    "S37": "ANALAG",
    "T0": "COMPARE",
    "T10": "MULT",
    "T11": "DIV",
    "T20": "MOVE",
    "T30": "STORE",
}
SPECIAL_NUMBERS = {name: number for number, name in SPECIAL_NAMES.items()}

_BASIC = ("S0", "S1", "S2", "S3", "S4")
_100C_12K = _BASIC + ("S20", "S32", "T0", "T10", "T11", "T20", "T30")
_130C = _BASIC + ("S11", "S12", "S20", "S22", "S23", "S30", "S31", "S32", "S34", "S35", "S36", "S37",
                  "T0", "T10", "T11", "T20", "T30")
_130C_12K = _130C + ("S33",)  # RAMP: 130C 12K and 130CE only

MICROGEM_LETTERS = "ABCDEFGHIJKLNOPRSUW"


@dataclass(frozen=True)
class ControllerModel:
    key: str
    family: str  # "microgem" or "gem80"
    title: str  # as printed on the controller, e.g. "GEM 80/130C"
    memory: str  # "2K", "6K" or "12K"
    instructions: int  # program capacity, in instructions
    tables: dict[str, int]  # words in each data table the controller has
    special: frozenset[str] = field(default_factory=frozenset)
    eprom: bool = False  # program and P table in EPROM: P is write-protected
    retained: str = "APRW"  # tables kept across a Halt -> Run transition

    @property
    def label(self) -> str:
        return f"{self.title} {self.memory}" if self.memory else self.title

    @property
    def printer(self) -> bool:
        """A printer port: the 130C and 130CE have one (T278)."""
        return "S22" in self.special and self.family == "gem80"

    @property
    def letters(self) -> str:
        return "".join(self.tables)

    @property
    def protected(self) -> str:
        """Tables the user program cannot write to."""
        return "EP" if self.eprom else "E"

    def info(self) -> dict:
        return {
            "key": self.key,
            "family": self.family,
            "title": self.title,
            "memory": self.memory,
            "label": self.label,
            "instructions": self.instructions,
            "tables": dict(self.tables),
            "special": sorted(self.special, key=lambda n: (n[0], int(n[1:]))),
            "eprom": self.eprom,
            "printer": self.printer,
        }


def _gem80(key, title, memory, instructions, p, e, f, g, jk, r, special, eprom=False):
    tables = {"A": 32, "B": 32, "E": e, "F": f, "G": g, "J": jk, "K": jk, "M": 10, "P": p, "R": r}
    return ControllerModel(key, "gem80", title, memory, instructions, tables,
                           frozenset(special), eprom, retained="APR")


MODELS: dict[str, ControllerModel] = {
    m.key: m
    for m in (
        ControllerModel(
            "microgem60", "microgem", "MicroGEM60", "", 2000,
            {letter: 64 for letter in MICROGEM_LETTERS}, frozenset(SPECIAL_NAMES),
        ),
        #      key              title          mem  instr  P (cfg+user) E  F (built-in+user) G   J/K  R
        _gem80("gem80-100c-2k", "GEM 80/100C", "2K", 456, 32 + 48, 1, 48 + 32, 65, 64, 40, _BASIC),
        _gem80("gem80-100c-6k", "GEM 80/100C", "6K", 1819, 32 + 48, 1, 48 + 32, 65, 64, 40, _BASIC),
        _gem80("gem80-100c-12k", "GEM 80/100C", "12K", 3900, 32 + 258, 1, 48 + 52, 415, 64, 300,
               _100C_12K),
        _gem80("gem80-100ce-12k", "GEM 80/100CE", "12K", 3898, 32 + 258, 1, 48 + 52, 415, 94, 300,
               _100C_12K, eprom=True),
        _gem80("gem80-130c-6k", "GEM 80/130C", "6K", 1404, 33 + 417, 7, 48 + 13, 200, 64, 100, _130C),
        _gem80("gem80-130c-12k", "GEM 80/130C", "12K", 3000, 72 + 1568, 7, 89 + 111, 800, 160, 400,
               _130C_12K),
        _gem80("gem80-130ce-12k", "GEM 80/130CE", "12K", 2998, 72 + 1568, 7, 89 + 111, 800, 160, 400,
               _130C_12K, eprom=True),
    )
}

DEFAULT_MODEL = "microgem60"
DEFAULT_GEM80 = "gem80-130c-12k"


def get_model(key: str) -> ControllerModel:
    try:
        return MODELS[key]
    except KeyError:
        raise ValueError(f"unknown controller model {key!r}") from None


# --- Compact I/O modules -------------------------------------------------------
# From Compact I/O Modules (Digital), T438 issue 6. A 100C/130C subrack has
# eight slots on the Basic I/O highway. A 32-channel module takes two
# consecutive words at an address fixed by its slot (slot 1: words 0 and 1,
# slot 2: words 2 and 3 ..., as in the GEM 80/131 manual T478, Table 3.6). The
# emulator gives every slot that pair of words, so a 16-channel module in slot
# n uses the first word and an 8-channel module its bits 0 to 7: on the real
# controller those addresses come from decoder switches.

SLOTS = 8

# The 8108 Compact Analogue Input Module (T443) multiplexes 16 channels of
# ±10 V (full scale 10.235 V) into one A table word, addressed like an 8-point
# module and twice as wide as the others: it takes two slots. Each channel
# takes 70 ± 20 ms to convert; the word holds the value in bits 4 to 15 (11
# bits plus sign, so full scale is 32752) and the channel in bits 0 to 3. The
# emulator has it in self-scan mode with all 16 channels, its word the first
# of its slot (the LOWER WORD switch setting).
ANALOGUE_FULL_SCALE_V = 10.235
ANALOGUE_CONVERSION_MS = 70
ANALOGUE_CHANNELS = 16


def analogue_word(volts: float, channel: int) -> int:
    """The 8108's output word for a channel at a voltage."""
    counts = round(max(-ANALOGUE_FULL_SCALE_V, min(ANALOGUE_FULL_SCALE_V, volts)) / ANALOGUE_FULL_SCALE_V * 32768)
    counts = max(-32752, min(32752, counts))  # 11 bits and sign: T443 Figure 11
    return (counts & 0xFFF0) | (channel & 0xF)


@dataclass(frozen=True)
class IOModule:
    code: str  # the module's type number, as on its front label
    kind: str  # "input" or "output"
    channels: int
    title: str
    relay: bool = False
    width: int = 1  # slots it takes in the subrack


IO_MODULES: dict[str, IOModule] = {
    m.code: m
    for m in (
        IOModule("8110", "input", 8, "8 channel input"),
        IOModule("8177", "input", 16, "16 channel input"),
        IOModule("8163", "input", 32, "32 channel input, 24 V d.c."),
        IOModule("8108", "analogue", 16, "16 channel analogue input, ±10 V", width=2),
        IOModule("8113", "output", 8, "8 channel output"),
        IOModule("8130", "output", 8, "8 channel relay output", relay=True),
        IOModule("8178", "output", 16, "16 channel output, 110 V a.c."),
        IOModule("8164", "output", 32, "32 channel output, 24 V d.c."),
    )
}

#: What a new GEM 80 has in its slots: 24 inputs, 24 outputs and an 8108
#: with 16 analogue inputs (in slots 5 and 6).
DEFAULT_MODULES = ("8177", "8178", "8110", "8130", "8108", None, None, None)


def get_module(code: str) -> IOModule:
    try:
        return IO_MODULES[code]
    except KeyError:
        raise ValueError(f"unknown I/O module {code!r}") from None


def slot_words(slot: int) -> tuple[int, int]:
    """The A or B table words that slot 1 to 8 owns."""
    return 2 * (slot - 1), 2 * (slot - 1) + 1
