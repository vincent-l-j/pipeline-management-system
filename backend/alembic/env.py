import os
import sys
from logging.config import fileConfig

# Registers the hook that makes autogenerate emit enum type CREATE/DROP and value
# syncs; without the import, enum changes and downgrade drops are silently missed.
from alembic import context
from sqlalchemy import create_engine, pool

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from app.models import Base

config = context.config

# Read DATABASE_URL straight from the environment, not via the app's Settings:
# migrations need only a DB connection, so `alembic` stays runnable with just
# DATABASE_URL set (e.g. the prod PRE_DEPLOY migrate job) without pulling in the
# app secrets Settings now requires. alembic.ini's url is only a fallback.
DATABASE_URL = os.environ.get("DATABASE_URL")
if DATABASE_URL:
    config.set_main_option("sqlalchemy.url", DATABASE_URL)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline():
    url = DATABASE_URL or config.get_main_option("sqlalchemy.url")
    context.configure(url=url, target_metadata=target_metadata, literal_binds=True)
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online():
    # Build the engine directly (not via engine_from_config) so a '%' in the DB
    # password isn't mangled by ConfigParser interpolation.
    url = DATABASE_URL or config.get_main_option("sqlalchemy.url")
    connectable = create_engine(url, poolclass=pool.NullPool)
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            # Detect type/default drift, not just add/drop of tables/columns —
            # otherwise an enum or type change slips past autogenerate.
            compare_type=True,
            compare_server_default=True,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
