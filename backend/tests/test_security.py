import datetime as dt
import uuid

import pytest

from api.core.exceptions import UnauthorizedError
from api.core.security import ACCESS_TOKEN_TTL, decode_access_token, issue_access_token


def test_issued_token_round_trips_user_and_role():
    user_id = uuid.uuid4()
    claims = decode_access_token(issue_access_token(user_id, "admin"))
    assert claims.user_id == user_id
    assert claims.role == "admin"


def test_expired_token_is_rejected():
    long_ago = dt.datetime.now(dt.UTC) - ACCESS_TOKEN_TTL - dt.timedelta(minutes=1)
    token = issue_access_token(uuid.uuid4(), "user", now=long_ago)
    with pytest.raises(UnauthorizedError):
        decode_access_token(token)


def test_garbage_token_is_rejected():
    with pytest.raises(UnauthorizedError):
        decode_access_token("not-a-jwt")
