#!/usr/bin/env python3
"""Create/read the local runmaxing runner identity without ever overwriting it."""
import datetime
import hashlib
import json
import os
import secrets
import sys


def identity_path():
    override = os.environ.get("RUNMAXING_IDENTITY")
    return os.path.abspath(os.path.expanduser(override or "~/.runmaxing/identity.json"))


def valid(data):
    if not isinstance(data, dict) or data.get("version") != 1:
        return False
    token = data.get("device_token") or ""
    expected = "runner_" + hashlib.sha256(token.encode()).hexdigest()[:24]
    return (
        len(token) == 64
        and all(c in "0123456789abcdef" for c in token)
        and data.get("runner_id") == expected
    )


def read_existing(path):
    try:
        with open(path) as fh:
            data = json.load(fh)
    except FileNotFoundError:
        return None
    except Exception as exc:
        raise RuntimeError(f"runner 신분증을 읽을 수 없어요: {path} ({exc})")
    if not valid(data):
        raise RuntimeError(f"기존 runner 신분증이 손상됐어요. 자동으로 덮어쓰지 않았습니다: {path}")
    return data


def create_once(path):
    existing = read_existing(path)
    if existing:
        return existing

    parent = os.path.dirname(path)
    os.makedirs(parent, mode=0o700, exist_ok=True)
    try:
        os.chmod(parent, 0o700)
    except Exception:
        pass

    token = secrets.token_hex(32)
    data = {
        "version": 1,
        "runner_id": "runner_" + hashlib.sha256(token.encode()).hexdigest()[:24],
        "device_token": token,
        "created_at": datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds"),
    }

    # 임시 파일을 완전히 쓴 뒤 hard-link 로 최종 경로를 만든다. link 는 대상이 이미
    # 있으면 실패하므로 동시 실행에서도 기존 파일을 덮어쓰지 않는다.
    tmp = f"{path}.tmp-{os.getpid()}-{secrets.token_hex(4)}"
    fd = os.open(tmp, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    try:
        payload = (json.dumps(data, ensure_ascii=False, indent=2) + "\n").encode()
        os.write(fd, payload)
        os.fsync(fd)
    finally:
        os.close(fd)
    try:
        os.link(tmp, path)
    except FileExistsError:
        return read_existing(path)
    finally:
        try:
            os.unlink(tmp)
        except FileNotFoundError:
            pass
    return data


def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else "ensure"
    path = identity_path()
    try:
        data = read_existing(path) if mode == "read" else create_once(path)
        if not data:
            raise RuntimeError(f"runner 신분증이 아직 없어요: {path}")
        print(json.dumps(data, ensure_ascii=False))
    except RuntimeError as exc:
        print(f"⚠️ {exc}", file=sys.stderr)
        raise SystemExit(1)


if __name__ == "__main__":
    main()
