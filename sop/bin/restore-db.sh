set -euo pipefail

: ${PROD_DATABASE_URL:?}
: ${HOST_CERT:?}

# PROD_DATABASE_URL="postgresql://doadmin:<password@app-<...>.ondigitalocean.com:12345"
# HOST_CERT="/path/to/ca-certificate.crt"
CONTAINER_CERT=/tmp/ca-certificate.crt
SSL_SUFFIX="sslmode=verify-full&sslrootcert=$CONTAINER_CERT"
RESTORE_DB=defaultdb
PROD_RESTORE_URL="$PROD_DATABASE_URL/$RESTORE_DB?$SSL_SUFFIX"
SQL_BACKUP=prod-db-backup.sql

# populate RESTORE_DB
docker compose run --rm -T -v "$HOST_CERT":$CONTAINER_CERT:ro \
    -e U="$PROD_RESTORE_URL" db sh -c 'psql -v ON_ERROR_STOP=1 "$U"' <$SQL_BACKUP
# backup RESTORE_DB
docker compose run --rm -T \
    -v "$HOST_CERT":$CONTAINER_CERT:ro \
    -e U="$PROD_RESTORE_URL" db \
    sh -c 'pg_dump --no-owner --no-privileges "$U"' >prod-$RESTORE_DB-backup.sql
# diff the backup and restored
echo ""
echo "Diff backup and restore"
diff prod-$RESTORE_DB-backup.sql $SQL_BACKUP
