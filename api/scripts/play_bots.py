"""Jugadores falsos para probar la API sin pedir ayuda a nadie.

Uso (con la API corriendo en :8000):
  python scripts/play_bots.py --room K7X4QM --bots 3    # los bots se unen a TU sala y juegan cuando inicies
  python scripts/play_bots.py --bots 3 --rounds 2       # crea su propia sala (un bot es host) y juega una partida

Solo usa la biblioteca estándar.
"""
import argparse
import json
import os
import random
import threading
import time
import urllib.error
import urllib.request

BASE = os.environ.get("API_BASE", "http://localhost:8000/api/v1")  # p. ej. https://triviacastro.<región>.cloudapp.azure.com/api/v1


def call(method: str, path: str, token: str | None = None, body: dict | None = None):
    req = urllib.request.Request(f"{BASE}{path}", method=method, data=json.dumps(body).encode() if body is not None else None)
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(req) as res:
            raw = res.read()
            return res.status, (json.loads(raw) if raw else None)
    except urllib.error.HTTPError as err:
        raw = err.read()
        return err.code, (json.loads(raw) if raw else None)


def play(name: str, token: str, game_id: str, skill: float) -> None:
    last_answered = 0
    while True:
        status, state = call("GET", f"/games/{game_id}/state", token)
        if status != 200:
            time.sleep(1)
            continue
        if state["phase"] == "FINAL":
            winner = state["winner"]
            print(f"[{name}] FINAL | ganó {winner['nickname']} con {winner['score']} | yo: {state['me']['score']}")
            return
        rnd = state["round"]
        if state["phase"] == "QUESTION" and state["me"]["status"] == "ACTIVE" and last_answered != rnd["number"]:
            last_answered = rnd["number"]
            time.sleep(random.uniform(1, 12))
            if state["me"]["powers"] and random.random() < 0.3:
                power = random.choice(state["me"]["powers"])["powerType"]
                call("POST", f"/games/{game_id}/rounds/{rnd['number']}/powers", token, {"powerType": power})
            options = call("GET", f"/games/{game_id}/state", token)[1]["round"]["question"]
            if options:
                pick = random.choice(options["options"])["id"]
                status, body = call("POST", f"/games/{game_id}/rounds/{rnd['number']}/answers", token, {"optionId": pick})
                print(f"[{name}] ronda {rnd['number']}: {pick} -> {status}")
        time.sleep(1)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--room", help="código de una sala existente")
    parser.add_argument("--bots", type=int, default=3)
    parser.add_argument("--rounds", type=int, default=3)
    args = parser.parse_args()

    names = ["Beto", "Caro", "Dani", "Eli", "Fer", "Gus", "Hugo"][: args.bots]
    sessions = []
    for name in names:
        _, player = call("POST", "/players", body={"nickname": name})
        sessions.append((name, player["token"]))

    if args.room:
        code, host_token = args.room.upper(), None
    else:
        host_name, host_token = sessions.pop(0)
        _, room = call("POST", "/rooms", host_token, {"settings": {"rounds": args.rounds}})
        code = room["code"]
        print(f"Sala creada por {host_name}: {code}")
    for name, token in sessions:
        status, body = call("POST", f"/rooms/{code}/players", token)
        print(f"[{name}] unirse a {code} -> {status}")
        if status >= 400:
            raise SystemExit(body)

    if host_token:
        status, game = call("POST", f"/rooms/{code}/games", host_token)
        if status != 201:
            raise SystemExit(game)
        game_id = game["gameId"]
        sessions.insert(0, (host_name, host_token))
    else:
        print("Esperando a que inicies la partida desde la web...")
        while True:
            room = call("GET", f"/rooms/{code}")[1]
            if room["currentGameId"]:
                game_id = room["currentGameId"]
                break
            time.sleep(1)

    threads = [threading.Thread(target=play, args=(n, t, game_id, 0.6), daemon=True) for n, t in sessions]
    for t in threads:
        t.start()
    for t in threads:
        t.join()


if __name__ == "__main__":
    main()
