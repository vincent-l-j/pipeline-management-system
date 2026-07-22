set -euo pipefail

: ${PROD_DATABASE_URL:?}
: ${HOST_CERT:?}

# PROD_DATABASE_URL="postgresql://doadmin:<password@app-<...>.ondigitalocean.com:12345"
# HOST_CERT="/path/to/ca-certificate.crt"
CONTAINER_CERT=/tmp/ca-certificate.crt
SSL_SUFFIX="sslmode=verify-full&sslrootcert=$CONTAINER_CERT"

db_names=(
    defaultdb
    db
)
for DB in "${db_names[@]}"; do
    docker compose run --rm -T \
        -v "$HOST_CERT":$CONTAINER_CERT:ro \
        -e U="$PROD_DATABASE_URL/$DB?$SSL_SUFFIX" db \
        sh -c 'pg_dump --no-owner --no-privileges "$U"' > prod-$DB-backup.sql
done
