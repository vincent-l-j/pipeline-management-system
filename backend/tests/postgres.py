import os
from collections.abc import Iterator
from contextlib import contextmanager

import psycopg2
from psycopg2 import sql
from sqlalchemy.engine import make_url


def _compose_url(database: str) -> str:
    return f"postgresql://rozetta:change_me_to_a_strong_password@db:5432/{database}"


def app_test_database_url() -> str:
    return os.environ.get("APP_TEST_DATABASE_URL", _compose_url("pms_app_test"))


@contextmanager
def admin_connection(url: str) -> Iterator[psycopg2.extensions.connection]:
    """An autocommit connection to `postgres`, the maintenance database every server has."""
    admin = make_url(url).set(database="postgres")
    connection = psycopg2.connect(admin.render_as_string(hide_password=False))
    connection.autocommit = True  # CREATE DATABASE cannot run inside a transaction
    try:
        yield connection
    finally:
        connection.close()


def database_exists(url: str) -> bool:
    with admin_connection(url) as connection, connection.cursor() as cursor:
        cursor.execute("SELECT 1 FROM pg_database WHERE datname = %s", (make_url(url).database,))
        return cursor.fetchone() is not None


def create_database_if_absent(url: str) -> None:
    """Create the database `url` names, so no environment needs a manual prep step.

    An absent *database* is something we can fix; an unreachable *server* is not,
    and its error propagates — a configured database that cannot be reached is a
    broken run, not an absent one.
    """
    if database_exists(url):
        return
    database = make_url(url).database
    with admin_connection(url) as connection, connection.cursor() as cursor:
        cursor.execute(sql.SQL("CREATE DATABASE {}").format(sql.Identifier(database)))
