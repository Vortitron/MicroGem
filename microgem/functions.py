"""GEM 80 Special Functions (the SPEC element).

Each function follows its GEM 80 Software Data sheet (Cegelec Controls,
1991-94, from automation-academy.uk): the rung input X (and for the T
functions the lower branch input Y), the VALUE location Zm with its parameter
list, the rung output Q, and the fault codes and flags written into Zm.

All of a function's state lives in its parameter list, as on the real
controller, so it is visible and can be preset from the program or the
programmer.
"""

from __future__ import annotations

import math
from collections.abc import Callable

from .tables import Address, AddressError, DataTables, to_signed

LIMIT = 32767


def _bits(*states: int) -> int:
    """A flag word with the given states (bits) ON, as a signed number."""
    return to_signed(sum(1 << s for s in set(states)))


def _limit(value: int) -> int:
    return max(-LIMIT, min(LIMIT, value))


class Context:
    """What a Special Function can see of the controller."""

    def __init__(self, tables: DataTables, protected: str) -> None:
        self.tables = tables
        self.protected = protected

    # Zm and the locations after it, in the same table.
    def fits(self, zm: Address, count: int) -> bool:
        return zm.word + count <= self.tables.size(zm.table)

    def writable(self, zm: Address) -> bool:
        return zm.table not in self.protected

    def get(self, zm: Address, offset: int = 0) -> int:
        return to_signed(self.tables.get_word(Address(zm.table, zm.word + offset)))

    def put(self, zm: Address, offset: int, value: int) -> None:
        if zm.table in self.protected:
            return
        self.tables.set_word(Address(zm.table, zm.word + offset), value)

    def number(self, value: Address | int) -> int:
        return value if isinstance(value, int) else self.get(value)


Function = Callable[[Context, int, int, "Address | int | None"], int]


# --- S functions: one rung input ----------------------------------------------

def dbounce(ctx: Context, x: int, _y: int, zm: Address) -> int:
    """S0 DBOUNCE. Zm: F, N scans, count C, previous output Q', mode M."""
    if not ctx.writable(zm) or not ctx.fits(zm, 5):
        return 0
    n, c, last, mode = (ctx.get(zm, i) for i in range(1, 5))
    if mode == 0 or n < 0:
        ctx.put(zm, 0, 9 if mode == 0 else 5)  # states 0&3, or 0&2
        ctx.put(zm, 2, 0)
        ctx.put(zm, 3, 0)
        return 0
    want = -1 if x else 0
    c = 0 if want == last else c + 1
    if c >= n:
        last, c = want, 0
    ctx.put(zm, 0, 0)
    ctx.put(zm, 2, c)
    ctx.put(zm, 3, last)
    return last


def bcdin(_ctx: Context, x: int, _y: int, _zm: None) -> int:
    """S1 BCDIN: up to four BCD decades to a number; -1 for a non-BCD digit."""
    raw = x & 0xFFFF
    digits = [(raw >> shift) & 0xF for shift in (12, 8, 4, 0)]
    if any(d > 9 for d in digits):
        return -1
    return int("".join(map(str, digits)))


def bcdout(_ctx: Context, x: int, _y: int, _zm: None) -> int:
    """S2 BCDOUT: |X| as four BCD decades, @9999 beyond the range."""
    return to_signed(int(str(min(abs(x), 9999)), 16))


def histate(_ctx: Context, x: int, _y: int, _zm: None) -> int:
    """S3 HISTATE: the number of the highest state that is ON, -1 if none."""
    raw = x & 0xFFFF
    return raw.bit_length() - 1 if raw else -1


def swap(_ctx: Context, x: int, _y: int, _zm: None) -> int:
    """S4 SWAP: interchange the two halves of the word."""
    raw = x & 0xFFFF
    return to_signed(((raw << 8) | (raw >> 8)) & 0xFFFF)


def lincon(ctx: Context, x: int, _y: int, zm: Address) -> int:
    """S11 LINCON: Q = M.X / D + C. Zm: F, M, D, C."""
    if not ctx.writable(zm) or not ctx.fits(zm, 4):
        return 0
    m, d, c = ctx.get(zm, 1), ctx.get(zm, 2), ctx.get(zm, 3)
    if d == 0:
        ctx.put(zm, 0, 5)
        return 0
    result = int(m * x / d) + c  # truncated towards zero
    if result <= -LIMIT:
        ctx.put(zm, 0, 65)
        return -LIMIT
    if result >= LIMIT:
        ctx.put(zm, 0, 129)
        return LIMIT
    ctx.put(zm, 0, 0)
    return result


def sqrt(ctx: Context, x: int, _y: int, value: Address | int) -> int:
    """S12 SQRT: Q = N.sqrt(|X|), with the sign of N.X."""
    n = ctx.number(value)
    q = round(abs(n) * math.sqrt(abs(x)))
    if (n < 0) != (x < 0) and q:
        q = -q
    return _limit(q)


def locate(ctx: Context, x: int, _y: int, zm: Address) -> int:
    """S20 LOCATE: the internal address of Zm plus X locations, -1 if invalid."""
    if not -9999 <= x <= 9999:
        return -1
    address = ctx.tables.internal(zm.table, zm.word + x)
    return -1 if address is None else to_signed(address)


def fgen(ctx: Context, x: int, _y: int, zm: Address) -> int:
    """S30 FGEN: interpolate between N points. Zm: F, X1, dX, N, Q1 .. QN."""
    if not ctx.fits(zm, 4):
        return 0
    x1, dx, n = ctx.get(zm, 1), ctx.get(zm, 2), ctx.get(zm, 3)
    fault = 0
    if n < 1:
        fault = 5
    elif dx < 1:
        fault = 9
    elif not ctx.fits(zm, 4 + n):
        fault = 3
    ctx.put(zm, 0, fault)  # suppressed when Zm is write-protected
    if fault:
        return 0
    if n == 1 or x <= x1:
        return ctx.get(zm, 4)
    span = x - x1
    segment, part = divmod(span, dx)
    if segment >= n - 1:
        return ctx.get(zm, 3 + n)
    q0, q1 = ctx.get(zm, 4 + segment), ctx.get(zm, 5 + segment)
    return _limit(q0 + math.floor((q1 - q0) * part / dx))


def dedband(ctx: Context, x: int, _y: int, zm: Address) -> int:
    """S31 DEDBAND: 0 inside +/-D, else X moved away from zero by S. Zm: F, D, S."""
    if not ctx.writable(zm) or not ctx.fits(zm, 3):
        return 0
    d, s = ctx.get(zm, 1), ctx.get(zm, 2)
    if d < 0:
        ctx.put(zm, 0, 5)
        return 0
    if abs(x) < d:
        ctx.put(zm, 0, _bits(13))
        return 0
    q = x + s if x > 0 else x - s if x < 0 else 0
    flags = 0
    if q > LIMIT:
        q, flags = LIMIT, _bits(7)
    elif q < -LIMIT:
        q, flags = -LIMIT, _bits(6)
    ctx.put(zm, 0, flags)
    return q


def limit(ctx: Context, x: int, _y: int, zm: Address) -> int:
    """S32 LIMIT: clamp X between L and H. Zm: F, L, H."""
    if not ctx.writable(zm) or not ctx.fits(zm, 3):
        return 0
    low, high = ctx.get(zm, 1), ctx.get(zm, 2)
    if low >= high:
        ctx.put(zm, 0, _bits(0, 2, 12, 14, 15))
        return 0
    if x > high:
        flags, q = _bits(9, 11, 12, 15), high
    elif x == high:
        flags, q = _bits(12, 15), x
    elif x == low:
        flags, q = _bits(12, 14), x
    elif x < low:
        flags, q = _bits(9, 10, 12, 14), low
    else:
        flags, q = 0, x
    ctx.put(zm, 0, flags)
    return q


def analag(ctx: Context, x: int, _y: int, zm: Address) -> int:
    """S37 ANALAG: first-order lag, Q = Q' + (G.(X - Q') + R) / 1000.

    Zm: F, G (1000 K, 1 to 1000), previous output Q', remainder R, mode M.
    """
    if not ctx.writable(zm) or not ctx.fits(zm, 5):
        return 0
    g, last, rem, mode = (ctx.get(zm, i) for i in range(1, 5))
    if mode == 0:
        ctx.put(zm, 0, 9)
        ctx.put(zm, 2, x)
        ctx.put(zm, 3, 0)
        return x
    if not 1 <= g <= 1000:
        ctx.put(zm, 0, 5)
        return 0
    total = g * (x - last) + rem
    step = int(total / 1000)
    q = _limit(last + step)
    ctx.put(zm, 0, 0)
    ctx.put(zm, 2, q)
    ctx.put(zm, 3, total - step * 1000)
    return q


def _fits_or_flag(ctx: Context, zm: Address, count: int) -> bool:
    """The parameter list fits in its table; if not, fault code 2 in Zm."""
    if ctx.fits(zm, count):
        return True
    ctx.put(zm, 0, 2)
    return False


def _sign(v: int) -> int:
    return (v > 0) - (v < 0)


def ramp(ctx: Context, x: int, _y: int, zm: Address) -> int:
    """S33 RAMP: rate-limited, rounded following of X.

    Zm: F, ACC, DEC (step size x 50 per scan, 0 to 16000), KA (rounding at the
    start: the step grows by KA/50 a scan), KB (rounding at the end: the step
    is at most KB/50 of the distance left, 0 to 50), QPOS, QNEG (output limits),
    S suicide (0 = on), H hold (0 = on), R raise, L lower, I current limit,
    Q' previous output, rate output (x 50), rate remainder.

    The data sheet gives the behaviour and the formulae for the values, not
    the arithmetic; this follows them: the step size, in fiftieths, rises by
    KA a scan to ACC (moving away from zero) or DEC (towards it), falls to KB
    times the distance left near the end, and the fiftieths carry over.
    """
    if not ctx.writable(zm) or not _fits_or_flag(ctx, zm, 15):
        return 0
    acc, dec, ka, kb, qpos, qneg, suicide, hold, raise_, lower, current, last, rate, rem = (
        ctx.get(zm, i) for i in range(1, 15))
    for bad, code, ok in ((acc, 5, 0 <= acc <= 16000), (dec, 9, 0 <= dec <= 16000),
                          (ka, 17, 0 <= ka <= 16000), (kb, 33, 0 <= kb <= 50),
                          (qpos, 65, 0 <= qpos <= 32000), (qneg, 129, -32000 <= qneg <= 0)):
        if not ok:
            ctx.put(zm, 0, code)
            for i in (12, 13, 14):
                ctx.put(zm, i, 0)
            return 0
    if suicide == 0:
        for i in (0, 12, 13, 14):
            ctx.put(zm, i, 0)
        return 0
    if hold == 0:
        target = None  # round off and stay
    elif lower:
        target = 0
    elif raise_:
        target = qneg if last < 0 else qpos
    else:
        target = max(qneg, min(qpos, x))
    if target is None:
        direction, rate = _sign(rate), max(0, abs(rate) - ka)
    elif target == last:
        direction, rate = 0, 0
    else:
        rate = abs(rate)
        direction = _sign(target - last)
        away = last == 0 or _sign(target - last) == _sign(last)
        top = acc if away else dec
        if away and current:
            top = max(0, min(top, top - current * _sign(last or target)))
        distance = abs(target - last)
        rate = min(rate + ka, top, kb * distance)
    total = rate + rem
    step, rem = divmod(total, 50)
    q = last + direction * step
    if target is not None and (q - target) * direction > 0:
        q, rem = target, 0
    q = max(qneg, min(qpos, q))
    flags = 0
    if target is not None and x > qpos and q == qpos:
        flags = _bits(12, 15)
    elif target is not None and x < qneg and q == qneg:
        flags = _bits(12, 14)
    ctx.put(zm, 0, flags)
    ctx.put(zm, 12, q)
    ctx.put(zm, 13, _limit(direction * rate))
    ctx.put(zm, 14, rem)
    return q


def _pid_gains_ok(p: int, i: int, d: int) -> bool:
    return abs(p + i + d) <= 65535 and abs(p + 2 * d) <= 65535


def pidabs(ctx: Context, x: int, _y: int, zm: Address) -> int:
    """S34 PIDABS: absolute three-term control, from the difference equation
    Q(n) = [P(X(n) - X(n-1)) + I.X(n) + D(X(n) - 2X(n-1) + X(n-2))] / 100 + Q(n-1).

    Zm: F, P, I, D, L+, L-, L1 (most change a scan away from zero), L2 (towards
    zero), S suicide (0 = on: Q goes to zero at the L2 rate), H hold (non-zero:
    Q stays), X(n-1), X(n-2), Q(n-1), integration remainder, rate remainder.
    """
    if not ctx.writable(zm) or not _fits_or_flag(ctx, zm, 15):
        return 0
    p, i, d, lpos, lneg, l1, l2, suicide, hold, x1, x2, last, r1, r2 = (ctx.get(zm, k) for k in range(1, 15))
    for code, ok in ((5, lpos >= 0), (9, lneg <= 0 and lneg != -32768), (17, l1 >= 0), (33, l2 >= 0),
                     (65, _pid_gains_ok(p, i, d))):
        if not ok:
            ctx.put(zm, 0, code)
            return 0
    if suicide == 0:
        want, r1, r2 = 0, 0, 0
    elif hold:
        want, r1 = last, r1
    else:
        total = p * (x - x1) + i * x + d * (x - 2 * x1 + x2) + r1
        change = int(total / 100)
        r1 = total - change * 100
        want = last + change + r2
    # Rate limits: L1 moving away from zero, L2 towards it; what is held back
    # carries over in the rate remainder.
    move = want - last
    away = last == 0 or _sign(move) == _sign(last)
    top = l1 if away else l2
    done = max(-top, min(top, move))
    q = last + done
    r2 = 0 if suicide == 0 or hold else _limit(move - done)
    flags = 0
    if q > lpos:
        q, r2, flags = lpos, 0, _bits(12, 15)
    elif q < lneg:
        q, r2, flags = lneg, 0, _bits(12, 14)
    ctx.put(zm, 0, flags)
    ctx.put(zm, 10, x)
    ctx.put(zm, 11, x1)
    ctx.put(zm, 12, q)
    ctx.put(zm, 13, r1)
    ctx.put(zm, 14, r2)
    return q


def pidinc(ctx: Context, x: int, _y: int, zm: Address) -> int:
    """S35 PIDINC: incremental three-term control, for actuators that
    integrate: Q(n) = [P(X(n) - X(n-1)) + I.X(n) + D(X(n) - 2X(n-1) + X(n-2))] / 100.

    Zm: F, P, I, D, L-, L+, X(n-1), X(n-2), S suicide (0 = on).
    """
    if not ctx.writable(zm) or not _fits_or_flag(ctx, zm, 9):
        return 0
    p, i, d, lneg, lpos, x1, x2, suicide = (ctx.get(zm, k) for k in range(1, 9))
    for ok in (lpos >= 0, lneg <= 0 and lneg != -32768):
        if not ok:
            ctx.put(zm, 0, 5)
            return 0
    if not _pid_gains_ok(p, i, d):
        ctx.put(zm, 0, 65)
        return 0
    ctx.put(zm, 6, x)
    ctx.put(zm, 7, x1)
    if suicide == 0:
        ctx.put(zm, 0, 9)
        return 0
    q = int((p * (x - x1) + i * x + d * (x - 2 * x1 + x2)) / 100)
    flags = 0
    if q > lpos:
        q, flags = lpos, _bits(12, 15)
    elif q < lneg:
        q, flags = lneg, _bits(12, 14)
    ctx.put(zm, 0, flags)
    return q


def incout(ctx: Context, x: int, _y: int, zm: Address) -> int:
    """S36 INCOUT: pass on what PIDINC asks for, within a window of QMIN to
    QMAX either side of zero, keeping the integral: whatever is not output yet
    is carried over. Zm: F, QMIN (dead zone), QMAX, sum of Q - sum of X, M (0 = reset).
    """
    if not ctx.writable(zm) or not _fits_or_flag(ctx, zm, 5):
        return 0
    qmin, qmax, owed, mode = (ctx.get(zm, k) for k in range(1, 5))
    if qmax < 0 or qmin < 0 or qmin > qmax:
        ctx.put(zm, 0, 5)
        ctx.put(zm, 3, 0)
        return 0
    if mode == 0:
        ctx.put(zm, 0, 9)
        ctx.put(zm, 3, _limit(-x))
        return 0
    total = x - owed  # what has been asked for and not yet given
    flags = 0
    if total > LIMIT:
        total, flags = LIMIT, _bits(7, 15)
    elif total < -LIMIT:
        total, flags = -LIMIT, _bits(6, 14)
    if abs(total) < qmin:
        q, flags = 0, flags or _bits(13)
    elif total > qmax:
        q, flags = qmax, flags or _bits(15)
    elif total < -qmax:
        q, flags = -qmax, flags or _bits(14)
    else:
        q = total
    ctx.put(zm, 0, flags)
    ctx.put(zm, 3, _limit(q - total))
    return q


# --- T functions: upper input X and lower input Y -----------------------------

def compare(ctx: Context, x: int, y: int, zm: Address) -> int:
    """T0 COMPARE: flags in Zm; the rung output is ON."""
    if not ctx.writable(zm):
        return 0
    if x > y:
        flags = _bits(10, 13, 14)
    elif x == y:
        flags = _bits(10, 12, 15)
    else:
        flags = _bits(11, 12, 14)
    ctx.put(zm, 0, flags)
    return -1


def mult(_ctx: Context, x: int, y: int, _zm: None) -> int:
    """T10 MULT: Q = X.Y, limited to +/-32767."""
    return _limit(x * y)


def div(ctx: Context, x: int, y: int, zm: Address) -> int:
    """T11 DIV: Q = (X - R) / Y, the remainder R (sign of X) into Zm."""
    if not ctx.writable(zm):
        return 0
    if y == 0:
        ctx.put(zm, 0, 0)
        return 0
    q = int(x / y)
    ctx.put(zm, 0, max(-32766, min(32766, x - q * y)))
    return _limit(q)


def move(ctx: Context, x: int, y: int, value: Address | int) -> int:
    """T20 MOVE: copy N locations from internal address X to Y. Q is a fault code."""
    n = ctx.number(value)
    if x == -1:
        return 9
    if y == -1:
        return 17
    if not 0 <= n <= 9999:
        return 33
    tables = ctx.tables
    src, dst = x & 0xFFFF, y & 0xFFFF
    src_area, dst_area = tables.area(src), tables.area(dst)
    if src_area is None or src + 2 * n > src_area[1]:
        return 3
    if dst_area is None or dst + 2 * n > dst_area[1]:
        return 5
    sources = [tables.locate(src + 2 * i) for i in range(n)]
    targets = [tables.locate(dst + 2 * i) for i in range(n)]
    if any(t.table in ctx.protected for t in targets):
        return 5
    words = [tables.get_word(a) for a in sources]  # copied first, so overlaps are safe
    for target, word in zip(targets, words):
        tables.set_word(target, word)
    return 0


def store(ctx: Context, x: int, y: int, zm: Address) -> int:
    """T30 STORE: a first-in first-out store of L words.

    X is the mode (1 WRITE, 2 READ, 3 WRITE then READ), Y the data in.
    Zm: F, write pointer WP, read displacement RD, length L, S(0) .. S(L-1).
    """
    if not ctx.writable(zm) or not ctx.fits(zm, 4):
        return 0
    length = ctx.get(zm, 3)
    if length < 1:
        ctx.put(zm, 0, 5)
        return 0
    if not ctx.fits(zm, 4 + length):
        ctx.put(zm, 0, 3)
        return 0
    if x not in (1, 2, 3):
        ctx.put(zm, 0, 0)
        return -1
    states: set[int] = set()
    wp, rd = ctx.get(zm, 1), ctx.get(zm, 2)
    q = -1
    if x in (1, 3):
        if not 0 <= wp < length:
            wp = 0
            states.add(8)
        if not 0 <= rd <= length:
            rd = 0 if rd < 0 else length
            states.add(9)
        ctx.put(zm, 4 + wp, y)
        wp = (wp + 1) % length
        if rd >= length:
            states.update((10, 11))
        else:
            rd += 1
            if rd == length:
                states.add(10)
    if x in (2, 3):
        if rd < 0:
            rd = 1
            states.add(9)
        elif rd > length:
            rd = length
            states.add(9)
        if rd == 0:
            q = ctx.get(zm, 4 + (wp - 1) % length)
            states.update((12, 13))
        else:
            q = ctx.get(zm, 4 + (wp - rd) % length)
            rd -= 1
            if rd == 0:
                states.add(12)
    ctx.put(zm, 0, _bits(*states) if states else 0)
    ctx.put(zm, 1, wp)
    ctx.put(zm, 2, rd)
    return q


FUNCTIONS: dict[str, Function] = {
    "S0": dbounce, "S1": bcdin, "S2": bcdout, "S3": histate, "S4": swap,
    "S11": lincon, "S12": sqrt, "S20": locate, "S30": fgen, "S31": dedband,
    "S32": limit, "S33": ramp, "S34": pidabs, "S35": pidinc, "S36": incout, "S37": analag,
    "T0": compare, "T10": mult, "T11": div, "T20": move, "T30": store,
}


def run(ctx: Context, number: str, x: int, y: int, value: Address | int | None) -> int:
    try:
        return FUNCTIONS[number](ctx, x, y, value)
    except AddressError:
        return 0
