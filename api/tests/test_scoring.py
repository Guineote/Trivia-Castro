from app import scoring


def test_ejemplo_del_contrato():
    # (800 + 316) x 2 = 2232 con 4.2 s en ronda DOUBLE.
    parts = scoring.points_for("MEDIUM", 4200, "DOUBLE", None)
    assert parts["speedBonus"] == 316
    assert parts["pointsAwarded"] == 2232


def test_bonus_de_velocidad_acotado():
    assert scoring.speed_bonus(0) == 400
    assert scoring.speed_bonus(20_000) == 0
    assert scoring.speed_bonus(25_000) == 0


def test_multiplicadores_se_combinan():
    # ronda DOUBLE x poder DOUBLE = x4 (D6)
    parts = scoring.points_for("EASY", 20_000, "DOUBLE", "DOUBLE")
    assert (parts["roundMultiplier"], parts["powerMultiplier"], parts["pointsAwarded"]) == (2, 2, 2000)


def test_otros_poderes_no_multiplican():
    assert scoring.points_for("HARD", 20_000, "NORMAL", "SHIELD")["pointsAwarded"] == 1100
